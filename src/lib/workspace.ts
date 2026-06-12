import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import type { AppUser } from "@/lib/auth";

export type Workspace = typeof workspaces.$inferSelect;

function randomSlug(): string {
  return `ws-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Returns the first workspace the user belongs to, creating a default
 * workspace (with an owner membership) on first use.
 */
export async function ensureDefaultWorkspace(user: AppUser): Promise<Workspace> {
  const existing = await db()
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (existing.length > 0) return existing[0].workspace;

  const [workspace] = await db()
    .insert(workspaces)
    .values({
      name: `${user.name}'s Workspace`,
      slug: randomSlug(),
      createdBy: user.id,
    })
    .returning();

  await db().insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: user.id,
    role: "owner",
  });

  return workspace;
}

/** Asserts the user is a member of the workspace; throws a 403-shaped error otherwise. */
export async function requireWorkspace(
  userId: string,
  workspaceId: string
): Promise<Workspace> {
  const rows = await db()
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (rows.length === 0) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
  return rows[0].workspace;
}

/**
 * Resolves the workspace for a request: validates membership when a
 * workspaceId is supplied, otherwise falls back to the user's default.
 */
export async function resolveWorkspace(
  user: AppUser,
  workspaceId?: string | null
): Promise<Workspace> {
  if (workspaceId) return requireWorkspace(user.id, workspaceId);
  return ensureDefaultWorkspace(user);
}
