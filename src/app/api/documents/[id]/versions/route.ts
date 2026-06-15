import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { getOwnedDocument } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { doc } = await getOwnedDocument(user, params.id, req);

  const items = await db()
    .select({
      id: documentVersions.id,
      version: documentVersions.version,
      title: documentVersions.title,
      createdBy: documentVersions.createdBy,
      createdAt: documentVersions.createdAt,
    })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, doc.id))
    .orderBy(desc(documentVersions.version));

  return NextResponse.json({ items });
});
