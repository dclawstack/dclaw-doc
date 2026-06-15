"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, History, Loader2 } from "lucide-react";
import { Editor } from "@/components/Editor";
import { StatusBadge, type DocStatus } from "@/components/StatusBadge";

type Doc = {
  id: string;
  title: string;
  contentJson: unknown;
  status: DocStatus;
  version: number;
};

type SaveState = "idle" | "saving" | "saved";

type Pending = { title?: string; contentJson?: unknown; contentMd?: string };

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState(1);
  const [saveState, setSaveState] = useState<SaveState>("idle");

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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
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
        <StatusBadge status={doc.status} />
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
        <Link
          href={`/docs/${id}/history`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 hover:text-zinc-900"
        >
          <History className="h-3.5 w-3.5" />
          History
        </Link>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (e.target.value.trim()) {
            queueSave({ title: e.target.value.trim() });
          }
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
  );
}
