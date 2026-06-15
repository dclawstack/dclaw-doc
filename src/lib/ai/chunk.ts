import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks } from "@/db/schema";
import { renderDocText } from "@/lib/render";
import { embed } from "./openrouter";

/** Splits document text into ~paragraph chunks capped at a sane length. */
export function chunkText(text: string): string[] {
  const paras = text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of paras) {
    if (p.length <= 1200) {
      out.push(p);
    } else {
      for (let i = 0; i < p.length; i += 1000) out.push(p.slice(i, i + 1000));
    }
  }
  return out.slice(0, 200);
}

/**
 * Re-chunks and re-embeds a document. Best-effort: callers should not block the
 * user save on this, and should swallow errors (AI may be unconfigured/down).
 * Replaces all existing chunks for the document.
 */
export async function reindexDocument(input: {
  documentId: string;
  workspaceId: string;
  title: string;
  contentJson: unknown;
  contentMd: string | null;
}): Promise<number> {
  const text = renderDocText(input.contentJson, input.contentMd);
  const chunks = chunkText(`${input.title}\n\n${text}`);

  await db().delete(documentChunks).where(eq(documentChunks.documentId, input.documentId));
  if (chunks.length === 0) return 0;

  const vectors = await embed(chunks, input.workspaceId);
  await db()
    .insert(documentChunks)
    .values(
      chunks.map((c, i) => ({
        documentId: input.documentId,
        workspaceId: input.workspaceId,
        ordinal: i,
        text: c,
        embedding: vectors[i],
      }))
    );
  return chunks.length;
}
