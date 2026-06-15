import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { resolveWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Per-workspace AI usage rollup: totals and a per-model breakdown. */
export const GET = withErrors(async (req) => {
  const user = await requireUser();
  const workspace = await resolveWorkspace(
    user,
    new URL(req.url).searchParams.get("workspaceId")
  );

  const byModel = await db()
    .select({
      model: aiUsage.model,
      requests: sql<number>`sum(${aiUsage.requests})::int`,
      tokensIn: sql<number>`sum(${aiUsage.tokensIn})::int`,
      tokensOut: sql<number>`sum(${aiUsage.tokensOut})::int`,
      costUsd: sql<number>`sum(${aiUsage.costUsd})::float`,
    })
    .from(aiUsage)
    .where(eq(aiUsage.workspaceId, workspace.id))
    .groupBy(aiUsage.model)
    .orderBy(desc(sql`sum(${aiUsage.costUsd})`));

  const totals = byModel.reduce(
    (acc, m) => ({
      requests: acc.requests + (m.requests ?? 0),
      tokensIn: acc.tokensIn + (m.tokensIn ?? 0),
      tokensOut: acc.tokensOut + (m.tokensOut ?? 0),
      costUsd: acc.costUsd + (m.costUsd ?? 0),
    }),
    { requests: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 }
  );

  return NextResponse.json({ totals, byModel });
});
