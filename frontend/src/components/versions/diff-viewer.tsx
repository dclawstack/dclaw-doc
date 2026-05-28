"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { DocumentVersionFull, getDocumentVersion } from "@/lib/api";

type DiffRow =
  | { kind: "context"; text: string }
  | { kind: "add"; text: string }
  | { kind: "remove"; text: string };

function diffLines(a: string, b: string): DiffRow[] {
  // Standard LCS-based line diff. Returns an interleaved sequence of
  // remove (old-only), add (new-only), and context (in both) rows.
  const oldLines = a.split("\n");
  const newLines = b.split("\n");
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      rows.push({ kind: "context", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ kind: "remove", text: oldLines[i] });
      i++;
    } else {
      rows.push({ kind: "add", text: newLines[j] });
      j++;
    }
  }
  while (i < m) rows.push({ kind: "remove", text: oldLines[i++] });
  while (j < n) rows.push({ kind: "add", text: newLines[j++] });
  return rows;
}

interface Props {
  documentId: string;
  versionNum: number;
  currentTitle: string;
  currentContent: string;
  onClose: () => void;
}

export function DiffViewer({
  documentId,
  versionNum,
  currentTitle,
  currentContent,
  onClose,
}: Props) {
  const [past, setPast] = useState<DocumentVersionFull | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await getDocumentVersion(documentId, versionNum);
        if (!cancelled) setPast(v);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, versionNum]);

  return (
    <div
      role="dialog"
      aria-label={`Diff version ${versionNum} vs current`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">
              v{versionNum} → current
            </h2>
            {past && (
              <p className="text-xs text-gray-500">
                {past.title} → {currentTitle}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {error && <p className="text-sm text-red-600">Error: {error}</p>}
          {!past && !error && <p className="text-sm text-gray-500">Loading…</p>}
          {past && (
            <ol className="space-y-0 font-mono text-xs leading-5">
              {diffLines(past.content_md || "", currentContent || "").map((row, idx) => (
                <li
                  key={idx}
                  className={
                    row.kind === "add"
                      ? "bg-green-50 px-2 text-green-900"
                      : row.kind === "remove"
                      ? "bg-red-50 px-2 text-red-900 line-through"
                      : "px-2 text-gray-700"
                  }
                >
                  <span className="mr-1 inline-block w-4 select-none text-gray-400">
                    {row.kind === "add" ? "+" : row.kind === "remove" ? "−" : " "}
                  </span>
                  {row.text || " "}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
