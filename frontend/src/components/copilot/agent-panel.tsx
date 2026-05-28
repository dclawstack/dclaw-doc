"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AgentResult, runAgent } from "@/lib/api";

/**
 * Agentic copilot UI — shows the full tool-call trace, not just the answer.
 *
 * Useful for the YC demo: a chat reply is invisible to reviewers, but
 * watching the agent decide to call ``search_workspace`` then ``redact_pii``
 * proves the system is doing real work, not just LLM wrapping.
 */
export function AgentPanel() {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await runAgent({ prompt: trimmed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent (tool-calling)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Tools available: <code>search_workspace</code>,{" "}
          <code>create_doc_from_template</code>, <code>redact_pii</code>,{" "}
          <code>summarize_doc</code>.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
          className="flex gap-2"
        >
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask the agent to do something…"
            aria-label="Agent prompt"
            disabled={running}
          />
          <Button type="submit" disabled={!prompt.trim() || running}>
            {running ? "Running…" : "Run"}
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {result && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Trace ({result.steps.length} steps)
            </h3>
            <ol className="space-y-2 text-sm">
              {result.steps.map((step, idx) => (
                <li
                  key={idx}
                  className={`rounded border px-3 py-2 ${
                    step.kind === "tool_call"
                      ? "border-amber-200 bg-amber-50"
                      : "border-indigo-200 bg-indigo-50"
                  }`}
                >
                  <p className="text-xs font-semibold">
                    {step.kind === "tool_call" ? `🔧 ${step.tool}` : "💬 Final answer"}
                  </p>
                  {step.arguments && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">
                      args: {JSON.stringify(step.arguments)}
                    </pre>
                  )}
                  {step.result !== null && step.result !== undefined && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-gray-700">
                      result: {JSON.stringify(step.result).slice(0, 600)}
                    </pre>
                  )}
                  {step.text && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {step.text}
                    </p>
                  )}
                </li>
              ))}
            </ol>

            <div className="rounded border border-gray-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Final answer
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{result.final_answer}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
