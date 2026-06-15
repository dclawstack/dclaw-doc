import "server-only";
import { MODELS } from "./models";
import { recordUsage } from "./usage";

const BASE = "https://openrouter.ai/api/v1";

function apiKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw Object.assign(new Error("AI is not configured"), { status: 503 });
  return key;
}

const HEADERS = () => ({
  Authorization: `Bearer ${apiKey()}`,
  "Content-Type": "application/json",
  "HTTP-Referer": "https://veridoc.app",
  "X-Title": "Veridoc",
});

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  workspaceId?: string;
  purpose?: string;
};

/** Non-streaming chat completion. Records token usage when a workspace is given. */
export async function chat(opts: ChatOptions): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1024,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`AI request failed: ${res.status} ${text.slice(0, 200)}`), {
      status: 502,
    });
  }
  const data = await res.json();
  const usage = data.usage ?? {};
  if (opts.workspaceId) {
    await recordUsage({
      workspaceId: opts.workspaceId,
      model: opts.model,
      purpose: opts.purpose ?? "chat",
      tokensIn: usage.prompt_tokens ?? 0,
      tokensOut: usage.completion_tokens ?? 0,
    }).catch(() => {});
  }
  return data.choices?.[0]?.message?.content ?? "";
}

/** Streaming chat completion as an async iterator of text deltas. */
export async function* chatStream(opts: ChatOptions): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1024,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`AI stream failed: ${res.status} ${text.slice(0, 200)}`), {
      status: 502,
    });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokensOut = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          tokensOut += 1;
          yield delta as string;
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }

  if (opts.workspaceId) {
    await recordUsage({
      workspaceId: opts.workspaceId,
      model: opts.model,
      purpose: opts.purpose ?? "copilot",
      tokensIn: 0,
      tokensOut,
    }).catch(() => {});
  }
}

/** Embeds an array of texts. Returns one vector per input. */
export async function embed(
  texts: string[],
  workspaceId?: string
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${BASE}/embeddings`, {
    method: "POST",
    headers: HEADERS(),
    body: JSON.stringify({ model: MODELS.embed, input: texts }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`Embedding failed: ${res.status} ${text.slice(0, 200)}`), {
      status: 502,
    });
  }
  const data = await res.json();
  if (workspaceId) {
    await recordUsage({
      workspaceId,
      model: MODELS.embed,
      purpose: "embed",
      tokensIn: data.usage?.prompt_tokens ?? 0,
      tokensOut: 0,
    }).catch(() => {});
  }
  return (data.data ?? []).map((d: { embedding: number[] }) => d.embedding);
}
