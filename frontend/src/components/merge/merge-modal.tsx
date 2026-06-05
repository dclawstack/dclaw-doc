"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DocumentVersionSummary,
  MergeResponse,
  listDocumentVersions,
  mergeOfflineEdits,
} from "@/lib/api";

interface Props {
  documentId: string;
  currentContent: string;
  onClose: () => void;
  onApplied?: (mergedContent: string) => void;
}

function renderMergedPreview(text: string): React.ReactNode {
  // Highlight conflict regions with subtle background colours so the
  // user can spot them at a glance.
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    let cls = "";
    if (line.startsWith("<<<<<<< ")) cls = "bg-red-50 text-red-900";
    else if (line === "=======") cls = "bg-gray-100 text-gray-500";
    else if (line.startsWith(">>>>>>> ")) cls = "bg-green-50 text-green-900";
    return (
      <span key={idx} className={`block whitespace-pre ${cls}`}>
        {line || " "}
      </span>
    );
  });
}

export function MergeModal({ documentId, currentContent, onClose, onApplied }: Props) {
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [baseVersion, setBaseVersion] = useState<number | null>(null);
  const [localContent, setLocalContent] = useState("");
  const [result, setResult] = useState<MergeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listDocumentVersions(documentId);
      setVersions(list);
      if (list.length > 0 && baseVersion === null) {
        setBaseVersion(list[list.length - 1].version_num); // earliest
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [documentId, baseVersion]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runMerge(persist: boolean) {
    if (baseVersion === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await mergeOfflineEdits(documentId, {
        base_version_num: baseVersion,
        local_content_md: localContent,
        persist,
      });
      setResult(r);
      if (persist && r.persisted) {
        onApplied?.(r.merged_content_md);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Resolve offline edits"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Reconcile offline edits</h2>
            <p className="text-xs text-gray-500">
              Pick the version you forked from, paste your local body, and the server
              will 3-way merge against the current state.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="grid flex-1 grid-cols-2 gap-4 overflow-auto p-4">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="merge-base">Base version</Label>
              {versions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No prior versions yet — edit the document at least once to create one.
                </p>
              ) : (
                <select
                  aria-label="Base version"
                  id="merge-base"
                  value={baseVersion ?? ""}
                  onChange={(e) => setBaseVersion(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                >
                  {versions.map((v) => (
                    <option key={v.version_num} value={v.version_num}>
                      v{v.version_num} · {v.title} ·{" "}
                      {new Date(v.created_at).toLocaleString()}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="merge-local">Your offline body</Label>
              <textarea
                aria-label="Your offline body"
                id="merge-local"
                value={localContent}
                onChange={(e) => setLocalContent(e.target.value)}
                placeholder="Paste the markdown you edited offline…"
                className="min-h-[260px] w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => runMerge(false)}
                disabled={busy || baseVersion === null}
              >
                Preview merge
              </Button>
              <Button
                onClick={() => runMerge(true)}
                disabled={busy || baseVersion === null || (result?.conflicts ?? 1) > 0}
              >
                Apply (persist)
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">Error: {error}</p>}
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Result
            </h3>
            {!result ? (
              <p className="text-sm text-gray-500">
                Run "Preview merge" to see the reconciled body.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-700">
                  conflicts: <strong>{result.conflicts}</strong>
                  {result.persisted && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-green-700">
                      persisted as v{result.server_version_num}
                    </span>
                  )}
                </p>
                <div className="overflow-auto rounded-md border border-gray-200 bg-white p-2 font-mono text-xs">
                  {renderMergedPreview(result.merged_content_md)}
                </div>
              </>
            )}

            <details>
              <summary className="cursor-pointer text-xs text-gray-500">
                Current server body (for reference)
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs">
                {currentContent}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
