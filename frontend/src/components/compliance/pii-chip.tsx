"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { PIIFinding, scanPII } from "@/lib/api";

interface Props {
  /** Debounced content to scan. */
  text: string;
}

/**
 * Live PII indicator. Calls /api/v1/compliance/scan whenever ``text``
 * settles for ~600ms. Shows a chip with the finding count + kinds; click
 * to expand the per-finding breakdown.
 */
export function PIIChip({ text }: Props) {
  const [findings, setFindings] = useState<PIIFinding[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setFindings([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await scanPII(text);
        setFindings(res.findings);
      } catch {
        // PII feature flag may be off — silent fail
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [text]);

  if (findings.length === 0) {
    return <Badge variant="secondary">No PII detected</Badge>;
  }

  const kinds = Array.from(new Set(findings.map((f) => f.kind))).sort();

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="inline-flex"
        aria-label="Show PII findings"
      >
        <Badge variant="destructive">
          {findings.length} PII · {kinds.join(", ")}
        </Badge>
      </button>
      {expanded && (
        <ul className="mt-2 max-h-32 overflow-auto rounded border border-red-100 bg-red-50 p-2 text-xs">
          {findings.map((f, idx) => (
            <li key={idx} className="font-mono">
              <span className="font-semibold uppercase text-red-700">{f.kind}</span>:{" "}
              {f.value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
