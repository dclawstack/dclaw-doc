"use client";

/**
 * DEMO-ONLY component — remove with the rest of the demo plumbing.
 *
 * Surfaces "Seed demo data" and "Reset to clean state" actions for
 * visitors to the landing page. Calls the matching /api/v1/demo/*
 * endpoints (which are themselves gated on the ``demo_endpoints``
 * feature flag — they 404 in production).
 *
 * To remove:
 *   1. Delete this file.
 *   2. Drop the <DemoControls /> render from the landing page.
 *   3. Drop seedDemoData / resetDemoData from src/lib/api.ts.
 */

import { useState } from "react";

import { resetDemoData, seedDemoData } from "@/lib/api";

type State =
  | { kind: "idle" }
  | { kind: "busy"; what: "seed" | "reset" }
  | { kind: "ok"; what: "seed" | "reset"; counts: Record<string, number> }
  | { kind: "error"; message: string };

export function DemoControls() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function handleSeed() {
    setState({ kind: "busy", what: "seed" });
    try {
      const { seeded } = await seedDemoData();
      setState({ kind: "ok", what: "seed", counts: seeded });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleReset() {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "Reset wipes every document, comment, template, version, " +
          "permission, and workspace other than 'personal'. Continue?",
      );
      if (!ok) return;
    }
    setState({ kind: "busy", what: "reset" });
    try {
      const { removed } = await resetDemoData();
      setState({ kind: "ok", what: "reset", counts: removed });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="border-y border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900"
          >
            ⚙
          </span>
          <div>
            <p className="font-medium text-amber-900">
              Demo mode — populate the workspace with sample content, or wipe
              it clean.
            </p>
            <DemoStatus state={state} />
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleSeed}
            disabled={state.kind === "busy"}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-amber-700 disabled:opacity-50"
          >
            {state.kind === "busy" && state.what === "seed"
              ? "Seeding…"
              : "Seed demo data"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={state.kind === "busy"}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
          >
            {state.kind === "busy" && state.what === "reset"
              ? "Resetting…"
              : "Reset to clean state"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DemoStatus({ state }: { state: State }) {
  if (state.kind === "idle")
    return (
      <p className="mt-0.5 text-xs text-amber-800">
        Seed creates 3 workspaces (Personal / Legal / Clinical) with documents,
        comments, versions, templates, and notarizations — enough to exercise
        every UI surface.
      </p>
    );
  if (state.kind === "busy")
    return (
      <p className="mt-0.5 text-xs text-amber-800">
        {state.what === "seed" ? "Seeding" : "Resetting"} — usually a second…
      </p>
    );
  if (state.kind === "error")
    return (
      <p className="mt-0.5 text-xs text-red-700">Error: {state.message}</p>
    );
  // ok
  const entries = Object.entries(state.counts);
  if (entries.length === 0)
    return (
      <p className="mt-0.5 text-xs text-emerald-700">
        ✓ {state.what === "seed" ? "Seeded" : "Reset"} — no changes needed.
      </p>
    );
  return (
    <p className="mt-0.5 text-xs text-emerald-700">
      ✓ {state.what === "seed" ? "Seeded" : "Removed"}{" "}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 ? " · " : ""}
          <strong>{v}</strong> {k}
        </span>
      ))}
    </p>
  );
}
