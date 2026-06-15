import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { resolveWorkspace } from "@/lib/workspace";
import { hybridSearch } from "@/lib/ai/search";
import { chatStream } from "@/lib/ai/openrouter";
import { MODELS } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(1).max(2000),
  workspaceId: z.uuid().optional(),
});

const SYSTEM = `You are Veridoc's compliance copilot. Answer ONLY from the numbered context passages.
Cite every claim with bracketed markers like [1], [2] that refer to the passage numbers.
If the context does not contain the answer, say so plainly — never invent facts.
Be concise and precise; this is for regulated teams who will be audited.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Streaming RAG copilot. Retrieves workspace chunks, streams a cited answer
 * from the frontier model, and emits a final citations event mapping the
 * [n] markers to source documents.
 */
export async function POST(req: Request) {
  let user, body;
  try {
    user = await requireUser();
    body = schema.parse(await req.json());
  } catch (e) {
    const status = (e as { status?: number }).status ?? 400;
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspace = await resolveWorkspace(user, body.workspaceId);
  const hits = await hybridSearch(workspace.id, body.question, 6);

  const context = hits
    .map((h, i) => `[${i + 1}] (from "${h.title}")\n${h.text}`)
    .join("\n\n");

  const citations = hits.map((h, i) => ({
    n: i + 1,
    documentId: h.documentId,
    title: h.title,
    ordinal: h.ordinal,
    score: Number(h.score?.toFixed?.(3) ?? h.score),
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(enc.encode(sse("citations", citations)));
      try {
        if (hits.length === 0) {
          controller.enqueue(
            enc.encode(
              sse(
                "token",
                "I couldn't find anything in this workspace's documents to answer that. Try adding or editing a document first."
              )
            )
          );
        } else {
          const messages = [
            { role: "system" as const, content: SYSTEM },
            {
              role: "user" as const,
              content: `Context passages:\n\n${context}\n\nQuestion: ${body.question}`,
            },
          ];
          for await (const delta of chatStream({
            model: MODELS.frontier,
            messages,
            temperature: 0.1,
            maxTokens: 800,
            workspaceId: workspace.id,
            purpose: "copilot",
          })) {
            controller.enqueue(enc.encode(sse("token", delta)));
          }
        }
        controller.enqueue(enc.encode(sse("done", {})));
      } catch (err) {
        controller.enqueue(
          enc.encode(sse("error", { message: (err as Error).message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
