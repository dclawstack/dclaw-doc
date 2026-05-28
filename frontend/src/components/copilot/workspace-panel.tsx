"use client";

import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Citation, streamWorkspaceChat } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
}

/**
 * Floating workspace-wide AI copilot.
 *
 * Mounted in the root layout so the panel is reachable from every page
 * (PRD §9 mandate). Calls `/api/v1/ai/chat` (workspace-scoped RAG).
 */
export function WorkspaceCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || streaming) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: prompt }, { role: "assistant", text: "" }]);
    setStreaming(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    await streamWorkspaceChat(
      { prompt },
      {
        onCitations: (citations) => {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.citations = citations;
            return next;
          });
        },
        onToken: (t) => {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.text += t;
            return next;
          });
        },
        onError: (err) => {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant") last.text += `\n[error: ${err.message}]`;
            return next;
          });
        },
        onDone: () => setStreaming(false),
      },
      ctrl.signal,
    );
    setStreaming(false);
  }, [draft, streaming]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-semibold text-white shadow-lg ring-2 ring-white hover:bg-indigo-700 focus:outline-none"
        aria-label="Open workspace copilot"
      >
        AI
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Workspace copilot"
          className="fixed bottom-0 right-0 top-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Workspace Copilot</h2>
              <p className="text-xs text-gray-500">Grounded in everything in this workspace.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close copilot"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              ✕
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-500">
                Ask anything about your workspace — answers are grounded in your documents and
                cite their sources.
              </p>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.text || (m.role === "assistant" && streaming ? "…" : "")}
                </div>
                {m.citations && m.citations.length > 0 && (
                  <ol className="mt-1 space-y-0.5 text-left text-xs text-gray-600">
                    {m.citations.map((c, i) => (
                      <li key={c.chunk_id} className="rounded bg-gray-50 px-2 py-1">
                        <span className="font-mono text-gray-500">[{i + 1}]</span>{" "}
                        <span className="font-medium">{c.document_title}</span>{" "}
                        <span className="text-gray-400">· chunk {c.ordinal}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-gray-200 px-4 py-3"
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask anything…"
              aria-label="Workspace chat input"
              disabled={streaming}
            />
            {streaming ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  abortRef.current?.abort();
                  setStreaming(false);
                }}
              >
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!draft.trim()}>
                Send
              </Button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
