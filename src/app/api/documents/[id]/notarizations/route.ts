import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notarizations } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { getOwnedDocument } from "@/lib/documents";
import { contentHash } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists notarizations for a document and re-computes the current content hash
 * so the client can show whether the latest approval still matches (verified)
 * or the content has since changed (stale).
 */
export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);

  const rows = await db()
    .select()
    .from(notarizations)
    .where(eq(notarizations.documentId, doc.id))
    .orderBy(desc(notarizations.createdAt));

  const currentHash = contentHash({
    title: doc.title,
    contentMd: doc.contentMd,
    contentJson: doc.contentJson,
    version: doc.version,
  });

  const items = rows.map((n) => ({
    ...n,
    verifiedAgainstCurrent: n.contentHash === currentHash,
  }));

  return NextResponse.json({ items, currentHash, currentVersion: doc.version });
});
