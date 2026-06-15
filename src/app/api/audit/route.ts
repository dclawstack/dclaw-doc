import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read the workspace audit trail, optionally filtered to one document. */
export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const workspace = await resolveWorkspace(user, url.searchParams.get("workspaceId"));
  const documentId = url.searchParams.get("documentId");
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200
  );

  const where = documentId
    ? and(
        eq(auditEvents.workspaceId, workspace.id),
        eq(auditEvents.documentId, documentId)
      )
    : eq(auditEvents.workspaceId, workspace.id);

  const items = await db()
    .select()
    .from(auditEvents)
    .where(where)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return NextResponse.json({ items });
});
