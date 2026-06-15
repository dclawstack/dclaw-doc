import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { folders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace, type Workspace } from "@/lib/workspace";
import type { AppUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Folder = typeof folders.$inferSelect;

async function getOwnedFolder(
  user: AppUser,
  id: string,
  req: Request
): Promise<{ workspace: Workspace; folder: Folder }> {
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  const workspace = await resolveWorkspace(user, workspaceId);
  const [folder] = await db()
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.workspaceId, workspace.id)))
    .limit(1);
  if (!folder) throw httpError(404, "Folder not found");
  return { workspace, folder };
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  parentId: z.uuid().nullable().optional(),
});

export const PATCH = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, folder } = await getOwnedFolder(user, params.id, req);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const { name, parentId } = parsed.data;

  if (parentId) {
    if (parentId === folder.id) throw httpError(400, "Folder cannot be its own parent");
    const [parent] = await db()
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, parentId), eq(folders.workspaceId, workspace.id)))
      .limit(1);
    if (!parent) throw httpError(400, "Parent folder not found in workspace");
  }

  const [updated] = await db()
    .update(folders)
    .set({
      name: name ?? folder.name,
      parentId: parentId !== undefined ? parentId : folder.parentId,
    })
    .where(eq(folders.id, folder.id))
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "folder.update",
    detail: { folderId: folder.id, fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(updated);
});

export const DELETE = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, folder } = await getOwnedFolder(user, params.id, req);

  // Detach child folders (parentId has no FK), then delete; documents keep
  // their rows via the FK's ON DELETE SET NULL.
  await db()
    .update(folders)
    .set({ parentId: null })
    .where(and(eq(folders.parentId, folder.id), eq(folders.workspaceId, workspace.id)));
  await db().delete(folders).where(eq(folders.id, folder.id));

  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "folder.delete",
    detail: { folderId: folder.id, name: folder.name },
  });

  return NextResponse.json({ ok: true });
});
