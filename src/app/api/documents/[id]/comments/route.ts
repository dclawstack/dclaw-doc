import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);
  const items = await db()
    .select()
    .from(comments)
    .where(eq(comments.documentId, doc.id))
    .orderBy(asc(comments.createdAt));
  return NextResponse.json({ items });
});

const createSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  parentId: z.uuid().nullish(),
  anchorBlockId: z.string().max(64).nullish(),
});

export const POST = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");

  const [comment] = await db()
    .insert(comments)
    .values({
      documentId: doc.id,
      parentId: parsed.data.parentId ?? null,
      anchorBlockId: parsed.data.anchorBlockId ?? null,
      body: parsed.data.body,
      authorId: user.id,
    })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "comment.create",
    detail: { commentId: comment.id, reply: !!parsed.data.parentId },
  });

  return NextResponse.json(comment, { status: 201 });
});
