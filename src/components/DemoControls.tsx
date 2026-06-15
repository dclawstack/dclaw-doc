// ============================================================================
// DEMO MODE — safe to delete for production. See DEMO.md / src/lib/demo-data.ts.
// Renders the "Load demo data / Clear" buttons on the landing page.
// ============================================================================
"use client";

import { useEffect, useState } from "react";
import { Database, Loader2, Sparkles, Trash2 } from "lucide-react";

type Counts = { documents: number; templates: number };

export function DemoControls() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/demo");
      if (res.ok) setCounts(await res.json());
    } catch {
      setCounts(null);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function run(action: "seed" | "clear") {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        setCounts({ documents: data.documents, templates: data.templates });
        setMsg(
          action === "seed"
            ? `Loaded ${data.documents} documents and ${data.templates} templates.`
            : "Workspace cleared to a fresh state."
        );
      } else {
        setMsg(data.error ?? "Something went wrong.");
      }
    } catch {
      setMsg("Request failed.");
    } finally {
      setBusy(null);
    }
  }

  const hasData = (counts?.documents ?? 0) > 0;

  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-amber-700">
        <Database className="h-3.5 w-3.5" />
        Demo controls
      </div>
      <p className="mb-4 text-center text-sm text-amber-800/80">
        {counts === null
          ? "Try the app with realistic content, or wipe it to a clean slate."
          : hasData
            ? `This workspace has ${counts.documents} documents and ${counts.templates} templates.`
            : "This workspace is empty."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => run("seed")}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "seed" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Load demo data
        </button>
        <button
          onClick={() => run("clear")}
          disabled={busy !== null || !hasData}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-50 disabled:opacity-50"
        >
          {busy === "clear" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Clear data
        </button>
      </div>
      {msg && <p className="mt-3 text-center text-xs text-amber-700">{msg}</p>}
    </div>
  );
}
