import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { resolveWorkspace } from "@/lib/workspace";
import { hybridSearch } from "@/lib/ai/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  query: z.string().trim().min(1).max(1000),
  topK: z.number().int().min(1).max(20).optional(),
  workspaceId: z.uuid().optional(),
});

export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const workspace = await resolveWorkspace(user, parsed.data.workspaceId);

  const hits = await hybridSearch(workspace.id, parsed.data.query, parsed.data.topK ?? 6);
  return NextResponse.json({ hits });
});
