import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import type { AppUser } from "@/lib/auth";
import { httpError } from "@/lib/api";
import { resolveWorkspace, type Workspace } from "@/lib/workspace";

export type Document = typeof documents.$inferSelect;

/**
 * Loads a non-deleted document scoped to the caller's workspace.
 * Accepts an optional request so `?workspaceId=` can override the default
 * workspace (membership is always asserted). 404s when out of scope.
 */
export async function getOwnedDocument(
  user: AppUser,
  id: string,
  req?: Request
): Promise<{ workspace: Workspace; doc: Document }> {
  const workspaceId = req
    ? new URL(req.url).searchParams.get("workspaceId")
    : null;
  const workspace = await resolveWorkspace(user, workspaceId);

  const [doc] = await db()
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.workspaceId, workspace.id),
        isNull(documents.deletedAt)
      )
    )
    .limit(1);
  if (!doc) throw httpError(404, "Document not found");
  return { workspace, doc };
}
