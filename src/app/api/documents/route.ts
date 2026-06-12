import { NextResponse } from "next/server";
import { and, count, desc, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const workspace = await resolveWorkspace(user, url.searchParams.get("workspaceId"));

  const q = url.searchParams.get("q")?.trim();
  const folderId = url.searchParams.get("folderId");
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1),
    100
  );
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0", 10) || 0, 0);

  const conditions: SQL[] = [
    eq(documents.workspaceId, workspace.id),
    isNull(documents.deletedAt),
  ];
  if (q) conditions.push(ilike(documents.title, `%${q}%`));
  if (folderId) conditions.push(eq(documents.folderId, folderId));
  const where = and(...conditions);

  const [items, totalRows] = await Promise.all([
    db()
      .select({
        id: documents.id,
        title: documents.title,
        folderId: documents.folderId,
        status: documents.status,
        sensitivity: documents.sensitivity,
        version: documents.version,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(where)
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset),
    db().select({ total: count() }).from(documents).where(where),
  ]);

  return NextResponse.json({ items, total: totalRows[0]?.total ?? 0 });
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  folderId: z.uuid().nullish(),
  workspaceId: z.uuid().optional(),
});

export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const body = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) throw httpError(400, "Invalid request body");
  const { title, folderId, workspaceId } = body.data;

  const workspace = await resolveWorkspace(user, workspaceId);

  const [doc] = await db()
    .insert(documents)
    .values({
      workspaceId: workspace.id,
      folderId: folderId ?? null,
      title: title ?? "Untitled",
      createdBy: user.id,
    })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.create",
    detail: { title: doc.title, folderId: doc.folderId },
  });

  return NextResponse.json(doc, { status: 201 });
});
