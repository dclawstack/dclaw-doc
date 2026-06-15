import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, shareLinks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Revoke a share link (soft: sets revokedAt). Scoped to the caller's workspace. */
export const DELETE = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );

  // Join through the document to enforce workspace ownership.
  const [row] = await db()
    .select({ link: shareLinks })
    .from(shareLinks)
    .innerJoin(documents, eq(shareLinks.documentId, documents.id))
    .where(
      and(
        eq(shareLinks.id, params.id),
        eq(documents.workspaceId, workspace.id),
        isNull(documents.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw httpError(404, "Share link not found");

  await db()
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.id, params.id));

  await logAudit({
    workspaceId: workspace.id,
    documentId: row.link.documentId,
    actorId: user.id,
    action: "share_link.revoke",
    detail: { token: row.link.token },
  });

  return NextResponse.json({ ok: true });
});
