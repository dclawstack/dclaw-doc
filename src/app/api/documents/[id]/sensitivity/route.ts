import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import { SENSITIVITIES } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ sensitivity: z.enum(SENSITIVITIES) });

export const PATCH = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid sensitivity");

  const [updated] = await db()
    .update(documents)
    .set({ sensitivity: parsed.data.sensitivity, updatedAt: new Date() })
    .where(eq(documents.id, doc.id))
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.sensitivity",
    detail: { from: doc.sensitivity, to: parsed.data.sensitivity },
  });

  return NextResponse.json(updated);
});
