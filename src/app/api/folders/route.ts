import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const workspace = await resolveWorkspace(user, url.searchParams.get("workspaceId"));

  const items = await db()
    .select()
    .from(folders)
    .where(eq(folders.workspaceId, workspace.id))
    .orderBy(asc(folders.name));

  return NextResponse.json({ items });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  parentId: z.uuid().nullish(),
  workspaceId: z.uuid().optional(),
});

export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const { name, parentId, workspaceId } = parsed.data;

  const workspace = await resolveWorkspace(user, workspaceId);

  if (parentId) {
    const [parent] = await db()
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.workspaceId, workspace.id)))
      .limit(1);
    if (!parent) throw httpError(400, "Parent folder not found in workspace");
  }

  const [folder] = await db()
    .insert(folders)
    .values({ workspaceId: workspace.id, parentId: parentId ?? null, name })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "folder.create",
    detail: { folderId: folder.id, name: folder.name, parentId: folder.parentId },
  });

  return NextResponse.json(folder, { status: 201 });
});
