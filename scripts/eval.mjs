/**
 * Eval harness for the cited copilot. For each golden case it embeds the doc's
 * text, retrieves it, asks the frontier model to answer with citations, and
 * checks the answer contains an expected phrase (and a citation when required).
 *
 * Run:  node scripts/eval.mjs            (prints pass rate, exits 1 if < threshold)
 * Env:  EVAL_THRESHOLD (default 0.75)
 *
 * This talks to OpenRouter directly (no DB) so it can run in CI without a
 * database. It mirrors the retrieval/answer logic of the /api/ai/copilot route.
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const KEY = process.env.OPENROUTER_API_KEY;
if (!KEY) {
  console.error("OPENROUTER_API_KEY not set");
  process.exit(2);
}
const THRESHOLD = Number(process.env.EVAL_THRESHOLD ?? "0.75");
const BASE = "https://openrouter.ai/api/v1";
const FRONTIER = "anthropic/claude-sonnet-4";

const SYSTEM = `You are Veridoc's compliance copilot. Answer ONLY from the numbered context passages.
Cite every claim with bracketed markers like [1]. If the context does not contain the answer,
say so plainly — never invent facts. Be concise.`;

async function answer(question, contextText) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: FRONTIER,
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Context passages:\n\n[1] ${contextText}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

const golden = JSON.parse(readFileSync(new URL("../evals/golden.json", import.meta.url)));
let passed = 0;
const results = [];

for (const c of golden.cases) {
  let ok = false;
  let detail = "";
  try {
    const out = await answer(c.question, c.doc.text);
    const lower = out.toLowerCase();
    const hit = c.expectAny.some((p) => lower.includes(p.toLowerCase()));
    const citationOk = !c.requireCitation || /\[\d+\]/.test(out);
    ok = hit && citationOk;
    detail = ok ? out.slice(0, 70).replace(/\n/g, " ") : `got: ${out.slice(0, 70).replace(/\n/g, " ")}`;
  } catch (e) {
    detail = e.message;
  }
  if (ok) passed++;
  results.push({ id: c.id, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${c.id} — ${detail}`);
}

const rate = passed / golden.cases.length;
console.log(`\nPass rate: ${(rate * 100).toFixed(0)}% (${passed}/${golden.cases.length}), threshold ${(THRESHOLD * 100).toFixed(0)}%`);
process.exit(rate >= THRESHOLD ? 0 : 1);
