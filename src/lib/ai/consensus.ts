import "server-only";
import { chat } from "./openrouter";
import { CONSENSUS_PANEL } from "./models";

export type ConsensusVerdict<T> = {
  decision: T;
  agreement: number; // 0..1 share of panel that backed the winning decision
  votes: { model: string; value: T | null; raw: string }[];
};

/**
 * Runs a binary/labelled decision across the diverse consensus panel and
 * returns the majority verdict. Used for compliance-critical calls where a
 * single model's error is costly (PII detection, citation verification).
 *
 * `parse` maps a model's raw text to a label or null (abstain on parse fail).
 */
export async function consensus<T extends string>(opts: {
  system: string;
  user: string;
  parse: (raw: string) => T | null;
  fallback: T;
  workspaceId?: string;
  purpose: string;
}): Promise<ConsensusVerdict<T>> {
  const results = await Promise.all(
    CONSENSUS_PANEL.map(async (model) => {
      try {
        const raw = await chat({
          model,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          temperature: 0,
          maxTokens: 200,
          workspaceId: opts.workspaceId,
          purpose: opts.purpose,
        });
        return { model, value: opts.parse(raw), raw };
      } catch {
        return { model, value: null as T | null, raw: "" };
      }
    })
  );

  const tally = new Map<T, number>();
  for (const r of results) {
    if (r.value !== null) tally.set(r.value, (tally.get(r.value) ?? 0) + 1);
  }

  let decision = opts.fallback;
  let best = 0;
  for (const [value, n] of Array.from(tally.entries())) {
    if (n > best) {
      best = n;
      decision = value;
    }
  }

  const voted = results.filter((r) => r.value !== null).length || 1;
  return { decision, agreement: best / voted, votes: results };
}
