"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Send, Sparkles } from "lucide-react";

type Citation = {
  n: number;
  documentId: string;
  title: string;
  ordinal: number;
  score: number;
};

type Turn = {
  question: string;
  answer: string;
  citations: Citation[];
  done: boolean;
};

export function CopilotPanel({ workspaceId }: { workspaceId?: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask() {
    const q = question.trim();
    if (!q || streaming) return;
    setQuestion("");
    setStreaming(true);
    const idx = turns.length;
    setTurns((t) => [...t, { question: q, answer: "", citations: [], done: false }]);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, workspaceId }),
      });
      if (!res.ok || !res.body) throw new Error("Copilot unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const evMatch = frame.match(/^event: (.+)$/m);
          const dataMatch = frame.match(/^data: (.+)$/m);
          if (!evMatch || !dataMatch) continue;
          const event = evMatch[1];
          const data = JSON.parse(dataMatch[1]);
          setTurns((prev) => {
            const next = [...prev];
            const turn = { ...next[idx] };
            if (event === "citations") turn.citations = data;
            else if (event === "token") turn.answer += data;
            else if (event === "done") turn.done = true;
            else if (event === "error") {
              turn.answer += `\n\n[error: ${data.message}]`;
              turn.done = true;
            }
            next[idx] = turn;
            return next;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
      }
    } catch (err) {
      setTurns((prev) => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          answer: (err as Error).message,
          done: true,
        };
        return next;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <Sparkles className="h-4 w-4 text-indigo-500" />
        Copilot
      </h3>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto pr-1 text-sm"
      >
        {turns.length === 0 && (
          <p className="text-xs leading-5 text-zinc-400">
            Ask anything about your workspace documents. Answers cite the exact
            passages they come from.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-1.5">
            <p className="font-medium text-zinc-800">{t.question}</p>
            <p className="whitespace-pre-wrap leading-6 text-zinc-600">
              {t.answer}
              {!t.done && (
                <Loader2 className="ml-1 inline h-3 w-3 animate-spin text-zinc-400" />
              )}
            </p>
            {t.citations.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {t.citations.map((c) => (
                  <Link
                    key={c.n}
                    href={`/docs/${c.documentId}`}
                    title={c.title}
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    [{c.n}] {c.title.slice(0, 22)}
                    {c.title.length > 22 ? "…" : ""}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
        className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your documents…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={streaming || !question.trim()}
          aria-label="Ask copilot"
          className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>
    </div>
  );
}
