import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/handler/sign-in");
  const workspace = await ensureDefaultWorkspace(user);

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
    (a, m) => ({
      requests: a.requests + (m.requests ?? 0),
      tokensIn: a.tokensIn + (m.tokensIn ?? 0),
      tokensOut: a.tokensOut + (m.tokensOut ?? 0),
      costUsd: a.costUsd + (m.costUsd ?? 0),
    }),
    { requests: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 }
  );

  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-lg font-semibold tracking-tight">AI usage</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Token spend by model. The router uses cheap models for routine work and a
        diverse panel only for compliance-critical calls — so cost stays low.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Requests" value={fmt(totals.requests)} />
        <Stat label="Tokens in" value={fmt(totals.tokensIn)} />
        <Stat label="Tokens out" value={fmt(totals.tokensOut)} />
        <Stat label="Est. cost" value={`$${totals.costUsd.toFixed(4)}`} />
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 text-right font-medium">Requests</th>
              <th className="px-4 py-2 text-right font-medium">Tokens</th>
              <th className="px-4 py-2 text-right font-medium">Est. cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {byModel.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  No AI usage yet. Ask the copilot or scan a document.
                </td>
              </tr>
            )}
            {byModel.map((m) => (
              <tr key={m.model}>
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">
                  {m.model}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600">
                  {fmt(m.requests ?? 0)}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600">
                  {fmt((m.tokensIn ?? 0) + (m.tokensOut ?? 0))}
                </td>
                <td className="px-4 py-2.5 text-right text-zinc-600">
                  ${(m.costUsd ?? 0).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
        {value}
      </div>
    </div>
  );
}
