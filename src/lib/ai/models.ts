/**
 * Model router. The product principle: spend the cheapest model that clears the
 * quality bar for each task, and only convene a multi-model consensus for
 * compliance-critical binary decisions where a single model's mistake is costly.
 */
export const MODELS = {
  // Cheap, fast — extraction, classification, title suggestions.
  cheap: "google/gemini-2.5-flash-lite",
  // Mid — RAG answers, summaries over retrieved context.
  mid: "google/gemini-2.5-flash",
  // Frontier — load-bearing cited compliance answers.
  frontier: "anthropic/claude-sonnet-4",
  // Embeddings — 1536 dims, matches documentChunks.embedding.
  embed: "openai/text-embedding-3-small",
} as const;

/**
 * Diverse panel for 2-of-3 consensus on compliance-critical calls
 * (PII detection, citation verification). Different providers so correlated
 * blind spots are less likely.
 */
export const CONSENSUS_PANEL = [
  "google/gemini-2.5-flash-lite",
  "openai/gpt-4o-mini",
  "meta-llama/llama-3.3-70b-instruct",
] as const;

export const EMBED_DIMS = 1536;
