import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );
  const items = await db()
    .select()
    .from(templates)
    .where(eq(templates.workspaceId, workspace.id))
    .orderBy(asc(templates.name));
  return NextResponse.json({ items });
});

const variableSchema = z.object({
  name: z.string().trim().min(1).max(64),
  label: z.string().max(120).optional(),
  default: z.string().max(2000).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().max(2000).nullish(),
  contentMd: z.string().max(200_000).default(""),
  variables: z.array(variableSchema).max(50).default([]),
  workspaceId: z.uuid().optional(),
});

export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const workspace = await resolveWorkspace(user, parsed.data.workspaceId);

  try {
    const [tpl] = await db()
      .insert(templates)
      .values({
        workspaceId: workspace.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        contentMd: parsed.data.contentMd,
        variablesSchema: parsed.data.variables,
      })
      .returning();

    await logAudit({
      workspaceId: workspace.id,
      actorId: user.id,
      action: "template.create",
      detail: { name: tpl.name },
    });

    return NextResponse.json(tpl, { status: 201 });
  } catch (err) {
    if (String((err as Error).message).includes("template_ws_name_unique")) {
      throw httpError(409, `Template "${parsed.data.name}" already exists`);
    }
    throw err;
  }
});
