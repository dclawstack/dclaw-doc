import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";

// Rough $/1M tokens for cost estimation (in, out). Approximate; for metering UX,
// not billing. Unknown models fall back to a small default.
const PRICING: Record<string, [number, number]> = {
  "google/gemini-2.5-flash-lite": [0.1, 0.4],
  "google/gemini-2.5-flash": [0.3, 2.5],
  "anthropic/claude-sonnet-4": [3, 15],
  "openai/gpt-4o-mini": [0.15, 0.6],
  "meta-llama/llama-3.3-70b-instruct": [0.1, 0.32],
  "openai/text-embedding-3-small": [0.02, 0],
};

export type UsageInput = {
  workspaceId: string;
  model: string;
  purpose: string;
  tokensIn: number;
  tokensOut: number;
};

function costUsd(model: string, tIn: number, tOut: number): number {
  const [pin, pout] = PRICING[model] ?? [0.2, 0.6];
  return (tIn * pin + tOut * pout) / 1_000_000;
}

/**
 * Increments the daily per-workspace/model/purpose usage rollup. Upsert keyed on
 * the unique (workspace, day, model, purpose) index so concurrent calls add up.
 */
export async function recordUsage(input: UsageInput): Promise<void> {
  const cost = costUsd(input.model, input.tokensIn, input.tokensOut);
  const day = new Date().toISOString().slice(0, 10);
  await db()
    .insert(aiUsage)
    .values({
      workspaceId: input.workspaceId,
      day,
      model: input.model,
      purpose: input.purpose,
      requests: 1,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      costUsd: cost.toFixed(6),
    })
    .onConflictDoUpdate({
      target: [aiUsage.workspaceId, aiUsage.day, aiUsage.model, aiUsage.purpose],
      set: {
        requests: sql`${aiUsage.requests} + 1`,
        tokensIn: sql`${aiUsage.tokensIn} + ${input.tokensIn}`,
        tokensOut: sql`${aiUsage.tokensOut} + ${input.tokensOut}`,
        costUsd: sql`${aiUsage.costUsd} + ${cost.toFixed(6)}`,
      },
    });
}
