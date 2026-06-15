import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";
import { getOwnedTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );
  const tpl = await getOwnedTemplate(workspace, params.id);
  return NextResponse.json(tpl);
});

export const DELETE = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );
  const tpl = await getOwnedTemplate(workspace, params.id);
  await db().delete(templates).where(eq(templates.id, tpl.id));
  await logAudit({
    workspaceId: workspace.id,
    actorId: user.id,
    action: "template.delete",
    detail: { name: tpl.name },
  });
  return NextResponse.json({ ok: true });
});
