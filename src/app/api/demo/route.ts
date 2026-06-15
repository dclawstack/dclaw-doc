// ============================================================================
// DEMO MODE — safe to delete for production. See DEMO.md / src/lib/demo-data.ts.
// ============================================================================
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { resolveWorkspace } from "@/lib/workspace";
import { clearWorkspaceData, countData, seedDemoData } from "@/lib/demo-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );
  return NextResponse.json(await countData(workspace));
});

const schema = z.object({
  action: z.enum(["seed", "clear"]),
  workspaceId: z.uuid().optional(),
});

export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const workspace = await resolveWorkspace(user, parsed.data.workspaceId);

  if (parsed.data.action === "seed") {
    const counts = await seedDemoData(workspace, user.id);
    return NextResponse.json({ action: "seed", ...counts });
  }
  await clearWorkspaceData(workspace);
  return NextResponse.json({ action: "clear", documents: 0, templates: 0 });
});
