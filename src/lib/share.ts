import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents, shareLinks } from "@/db/schema";

export type SharedDocument = {
  title: string;
  contentMd: string | null;
  contentJson: unknown;
  status: string;
  version: number;
  permission: "view" | "edit";
};

/** Resolves a public share token to a document, enforcing revoke + expiry. */
export async function resolveShareToken(
  token: string
): Promise<SharedDocument | null> {
  const [row] = await db()
    .select({
      title: documents.title,
      contentMd: documents.contentMd,
      contentJson: documents.contentJson,
      status: documents.status,
      version: documents.version,
      permission: shareLinks.permission,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
    })
    .from(shareLinks)
    .innerJoin(documents, eq(shareLinks.documentId, documents.id))
    .where(and(eq(shareLinks.token, token), isNull(documents.deletedAt)))
    .limit(1);

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  return {
    title: row.title,
    contentMd: row.contentMd,
    contentJson: row.contentJson,
    status: row.status,
    version: row.version,
    permission: row.permission,
  };
}
