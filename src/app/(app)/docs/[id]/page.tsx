"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, History, Loader2, ScanSearch } from "lucide-react";
import { Editor } from "@/components/Editor";
import { StatusBadge, type DocStatus } from "@/components/StatusBadge";
import { SensitivityBadge, type Sensitivity } from "@/components/SensitivityBadge";
import { TrustPanel } from "@/components/TrustPanel";
import { CopilotPanel } from "@/components/CopilotPanel";
import { CommentsPanel } from "@/components/CommentsPanel";
import { ExportMenu } from "@/components/ExportMenu";

type Doc = {
  id: string;
  title: string;
  contentJson: unknown;
  status: DocStatus;
  sensitivity: Sensitivity;
  version: number;
};

type SaveState = "idle" | "saving" | "saved";
type Pending = { title?: string; contentJson?: unknown; contentMd?: string };
type Tab = "copilot" | "trust" | "comments";

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<DocStatus>("draft");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("public");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [tab, setTab] = useState<Tab>("copilot");
  const [refreshKey, setRefreshKey] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const pendingRef = useRef<Pending>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/documents/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Document not found");
        return (await res.json()) as Doc;
      })
      .then((data) => {
        if (cancelled) return;
        setDoc(data);
        setTitle(data.title);
        setVersion(data.version);
        setStatus(data.status);
        setSensitivity(data.sensitivity);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flush = useCallback(async () => {
    const payload = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(payload).length === 0) return;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated: Doc = await res.json();
        setVersion(updated.version);
        setSaveState("saved");
        setRefreshKey((k) => k + 1);
      } else {
        setSaveState("idle");
      }
    } catch {
      setSaveState("idle");
    }
  }, [id]);

  const queueSave = useCallback(
    (partial: Pending) => {
      pendingRef.current = { ...pendingRef.current, ...partial };
      setSaveState("saving");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 1500);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function runPiiScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/ai/pii-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult(
          `Suggested: ${data.suggested.toUpperCase()} (${Math.round(
            data.agreement * 100
          )}% panel agreement)`
        );
        setTab("trust");
      } else {
        setScanResult(data.error ?? "Scan failed");
      }
    } catch {
      setScanResult("Scan failed");
    } finally {
      setScanning(false);
    }
  }

  if (error) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-zinc-500">{error}</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex gap-8">
      <div className="mx-auto min-w-0 max-w-3xl flex-1">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard"
            aria-label="Back to dashboard"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
            v{version}
          </span>
          <StatusBadge status={status} />
          <SensitivityBadge sensitivity={sensitivity} />
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-zinc-400">
            {saveState === "saving" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
              </>
            )}
            {saveState === "saved" && (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved
              </>
            )}
          </span>
          <button
            onClick={runPiiScan}
            disabled={scanning}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {scanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ScanSearch className="h-3.5 w-3.5" />
            )}
            Scan sensitivity
          </button>
          <ExportMenu docId={id} />
          <Link
            href={`/docs/${id}/history`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
          >
            <History className="h-3.5 w-3.5" />
            History
          </Link>
        </div>

        {scanResult && (
          <div className="mb-4 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            {scanResult}
          </div>
        )}

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim()) queueSave({ title: e.target.value.trim() });
          }}
          placeholder="Untitled"
          aria-label="Document title"
          className="mb-4 w-full border-none bg-transparent text-3xl font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none"
        />

        <Editor
          initialContent={doc.contentJson}
          onChange={(contentJson, text) =>
            queueSave({ contentJson, contentMd: text })
          }
        />
      </div>

      <div className="hidden w-80 shrink-0 lg:block">
        <div className="sticky top-20 flex h-[calc(100vh-7rem)] flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
            {(["copilot", "trust", "comments"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-1.5 capitalize ${
                  tab === t ? "bg-white shadow-sm" : "text-zinc-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "copilot" && <CopilotPanel />}
            {tab === "comments" && <CommentsPanel docId={id} />}
            {tab === "trust" && (
              <TrustPanel
                docId={id}
                sensitivity={sensitivity}
                status={status}
                onStatusChange={(s) => {
                  setStatus(s as DocStatus);
                  setRefreshKey((k) => k + 1);
                }}
                onSensitivityChange={setSensitivity}
                refreshKey={refreshKey}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
