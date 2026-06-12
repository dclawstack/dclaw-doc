import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { getOwnedDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);

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

  return NextResponse.json(snapshot);
});
