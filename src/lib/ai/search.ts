import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { embed } from "./openrouter";

export type SearchHit = {
  documentId: string;
  title: string;
  ordinal: number;
  text: string;
  score: number;
};

/**
 * Hybrid retrieval over a workspace's chunks: vector cosine similarity (pgvector
 * `<=>`) blended with lexical ILIKE matching. Returns top-k chunks with the
 * owning document title for citation rendering.
 */
export async function hybridSearch(
  workspaceId: string,
  query: string,
  topK = 6
): Promise<SearchHit[]> {
  const [queryVec] = await embed([query], workspaceId);
  const vecLiteral = `[${queryVec.join(",")}]`;
  const like = `%${query.replace(/[%_]/g, "")}%`;

  // 1 - cosine_distance gives similarity in [0,1]; add a small lexical boost.
  const rows = await db().execute(sql`
    select
      c.document_id as "documentId",
      d.title as "title",
      c.ordinal as "ordinal",
      c.text as "text",
      (1 - (c.embedding <=> ${vecLiteral}::vector))
        + (case when c.text ilike ${like} then 0.15 else 0 end) as "score"
    from document_chunks c
    join documents d on d.id = c.document_id
    where c.workspace_id = ${workspaceId}
      and d.deleted_at is null
    order by "score" desc
    limit ${topK}
  `);

  return (rows as unknown as { rows: SearchHit[] }).rows ?? (rows as unknown as SearchHit[]);
}
