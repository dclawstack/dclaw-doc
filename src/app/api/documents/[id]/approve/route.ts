import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, notarizations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import { contentHash } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve + notarize: set status=approved and record a tamper-evident
 * SHA-256 of the document content at this version. The hash is verifiable
 * later via GET /api/documents/[id]/notarizations.
 */
export const POST = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);

  const hash = contentHash({
    title: doc.title,
    contentMd: doc.contentMd,
    contentJson: doc.contentJson,
    version: doc.version,
  });

  const [notarization] = await db()
    .insert(notarizations)
    .values({
      documentId: doc.id,
      version: doc.version,
      contentHash: hash,
      createdBy: user.id,
    })
    .returning();

  const [updated] = await db()
    .update(documents)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(documents.id, doc.id))
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.approve",
    detail: { version: doc.version, contentHash: hash },
  });

  return NextResponse.json({ document: updated, notarization });
});
