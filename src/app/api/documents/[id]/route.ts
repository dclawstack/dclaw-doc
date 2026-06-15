import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, documentVersions, folders } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import { reindexDocument } from "@/lib/ai/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);
  return NextResponse.json(doc);
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  contentJson: z.unknown().optional(),
  contentMd: z.string().optional(),
  folderId: z.uuid().nullable().optional(),
});

export const PATCH = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const { title, contentJson, contentMd, folderId } = parsed.data;

  // Validate the target folder belongs to the same workspace.
  if (folderId) {
    const [folder] = await db()
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.workspaceId, workspace.id)))
      .limit(1);
    if (!folder) throw httpError(400, "Folder not found in workspace");
  }

  const contentChanged =
    (contentJson !== undefined &&
      JSON.stringify(contentJson) !== JSON.stringify(doc.contentJson)) ||
    (contentMd !== undefined && contentMd !== doc.contentMd);

  const nextVersion = contentChanged ? doc.version + 1 : doc.version;
  const nextTitle = title ?? doc.title;
  const nextJson = contentJson !== undefined ? contentJson : doc.contentJson;
  const nextMd = contentMd !== undefined ? contentMd : doc.contentMd;

  const [updated] = await db()
    .update(documents)
    .set({
      title: nextTitle,
      contentJson: nextJson,
      contentMd: nextMd,
      folderId: folderId !== undefined ? folderId : doc.folderId,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id))
    .returning();

  if (contentChanged) {
    await db().insert(documentVersions).values({
      documentId: doc.id,
      version: nextVersion,
      title: nextTitle,
      contentJson: nextJson,
      contentMd: nextMd,
      createdBy: user.id,
    });

    // Re-index for RAG. Best-effort: AI may be unconfigured or down, and a
    // failed embedding must never fail the user's save.
    try {
      await reindexDocument({
        documentId: doc.id,
        workspaceId: workspace.id,
        title: nextTitle,
        contentJson: nextJson,
        contentMd: nextMd ?? null,
      });
    } catch (err) {
      console.error("reindex failed", err);
    }
  }

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.update",
    detail: {
      fields: Object.keys(parsed.data),
      version: nextVersion,
      snapshot: contentChanged,
    },
  });

  return NextResponse.json(updated);
});

export const DELETE = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);

  await db()
    .update(documents)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(documents.id, doc.id));

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.delete",
    detail: { title: doc.title },
  });

  return NextResponse.json({ ok: true });
});
