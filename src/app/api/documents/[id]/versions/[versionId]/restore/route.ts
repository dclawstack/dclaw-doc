import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);

  const [snapshot] = await db()
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, params.versionId),
        eq(documentVersions.documentId, doc.id)
      )
    )
    .limit(1);
  if (!snapshot) throw httpError(404, "Version not found");

  const nextVersion = doc.version + 1;

  const [updated] = await db()
    .update(documents)
    .set({
      title: snapshot.title,
      contentJson: snapshot.contentJson,
      contentMd: snapshot.contentMd,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id))
    .returning();

  await db().insert(documentVersions).values({
    documentId: doc.id,
    version: nextVersion,
    title: snapshot.title,
    contentJson: snapshot.contentJson,
    contentMd: snapshot.contentMd,
    createdBy: user.id,
  });

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.restore",
    detail: { restoredFromVersion: snapshot.version, newVersion: nextVersion },
  });

  return NextResponse.json(updated);
});
