import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comments, documents } from "@/db/schema";
import { requireUser, type AppUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loads a comment scoped to the caller's workspace (joined via its document). */
async function ownedComment(req: Request, user: AppUser, commentId: string) {
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );
  const [row] = await db()
    .select({ comment: comments, workspaceId: documents.workspaceId })
    .from(comments)
    .innerJoin(documents, eq(comments.documentId, documents.id))
    .where(
      and(
        eq(comments.id, commentId),
        eq(documents.workspaceId, workspace.id),
        isNull(documents.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw httpError(404, "Comment not found");
  return { comment: row.comment, workspaceId: workspace.id };
}

const patchSchema = z.object({
  body: z.string().trim().min(1).max(10_000).optional(),
  resolved: z.boolean().optional(),
});

export const PATCH = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { comment, workspaceId } = await ownedComment(req, user, params.id);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");

  const updates: Partial<typeof comments.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.body !== undefined) updates.body = parsed.data.body;
  if (parsed.data.resolved !== undefined) {
    updates.resolvedAt = parsed.data.resolved ? new Date() : null;
  }

  const [updated] = await db()
    .update(comments)
    .set(updates)
    .where(eq(comments.id, comment.id))
    .returning();

  await logAudit({
    workspaceId,
    documentId: comment.documentId,
    actorId: user.id,
    action: parsed.data.resolved !== undefined ? "comment.resolve" : "comment.update",
    detail: { commentId: comment.id, resolved: parsed.data.resolved },
  });

  return NextResponse.json(updated);
});

export const DELETE = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { comment, workspaceId } = await ownedComment(req, user, params.id);
  await db().delete(comments).where(eq(comments.id, comment.id));
  await logAudit({
    workspaceId,
    documentId: comment.documentId,
    actorId: user.id,
    action: "comment.delete",
    detail: { commentId: comment.id },
  });
  return NextResponse.json({ ok: true });
});
