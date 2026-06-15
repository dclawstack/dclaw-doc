import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { shareLinks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import { shareToken } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);
  const rows = await db()
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.documentId, doc.id))
    .orderBy(desc(shareLinks.createdAt));
  return NextResponse.json({ items: rows });
});

const createSchema = z.object({
  permission: z.enum(["view", "edit"]).default("view"),
  expiresInDays: z.number().int().min(1).max(365).nullish(),
});

export const POST = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw httpError(400, "Invalid request body");

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const [link] = await db()
    .insert(shareLinks)
    .values({
      documentId: doc.id,
      token: shareToken(),
      permission: parsed.data.permission,
      expiresAt,
      createdBy: user.id,
    })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "share_link.create",
    detail: { permission: link.permission, expiresAt },
  });

  return NextResponse.json(link, { status: 201 });
});
