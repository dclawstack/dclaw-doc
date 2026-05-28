"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Citation, CopilotMode, streamDocChat } from "@/lib/api";

const MODES: CopilotMode[] = ["chat", "summarize", "rewrite", "explain", "translate"];

interface Props {
  documentId?: string;
  selection?: string;
}

export function CopilotPanel({ documentId, selection }: Props) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<CopilotMode>("chat");
  const [response, setResponse] = useState("");
  const [meta, setMeta] = useState<{ provider: string; model: string; rag_hits?: number } | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [usage, setUsage] = useState<{ prompt_tokens: number | null; completion_tokens: number | null } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (!prompt.trim()) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    setResponse("");
    setMeta(null);
    setUsage(null);
    setCitations([]);
    await streamDocChat(
      { prompt: prompt.trim(), document_id: documentId, selection, mode },
      {
        onMeta: setMeta,
        onCitations: setCitations,
        onToken: (t) => setResponse((prev) => prev + t),
        onUsage: setUsage,
        onDone: () => setStreaming(false),
        onError: (err) => {
          setResponse((prev) => prev + `\n[error: ${err.message}]`);
          setStreaming(false);
        },
      },
      ctrl.signal,
    );
    setStreaming(false);
  }, [prompt, documentId, selection, mode]);

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <section
      aria-label="AI copilot"
      className="rounded-md border border-gray-200 bg-white p-4 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">AI Copilot</h2>
        {meta && (
          <span className="text-xs text-gray-500">
            {meta.provider} · {meta.model}
          </span>
        )}
      </header>

      <div className="flex flex-wrap gap-1 pb-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full border px-2 py-0.5 text-xs ${
              mode === m
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !streaming) {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Ask the copilot…"
          aria-label="Copilot prompt"
          disabled={streaming}
        />
        {streaming ? (
          <Button variant="outline" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button onClick={run} disabled={!prompt.trim()}>
            Run
          </Button>
        )}
      </div>

      {response && (
        <pre className="mt-3 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm">
          {response}
        </pre>
      )}

      {citations.length > 0 && (
        <div className="mt-3">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Citations
          </h3>
          <ol className="space-y-1 text-xs text-gray-700">
            {citations.map((c, idx) => (
              <li key={c.chunk_id} className="rounded border border-gray-100 px-2 py-1">
                <span className="font-mono text-gray-500">[{idx + 1}]</span>{" "}
                <span className="font-medium">{c.document_title}</span>{" "}
                <span className="text-gray-400">· chunk {c.ordinal}</span>
                <span className="ml-2 text-gray-400">
                  score {c.score.toFixed(2)}
                </span>
                <p className="mt-1 line-clamp-3 text-gray-600">{c.text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {usage && (
        <p className="mt-2 text-xs text-gray-500">
          tokens · in {usage.prompt_tokens ?? "?"} · out {usage.completion_tokens ?? "?"}
          {meta?.rag_hits ? ` · rag ${meta.rag_hits}` : ""}
        </p>
      )}
    </section>
  );
}
