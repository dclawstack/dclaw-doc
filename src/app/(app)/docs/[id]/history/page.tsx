"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

type VersionRow = {
  id: string;
  version: number;
  title: string;
  createdBy: string;
  createdAt: string;
};

type Snapshot = VersionRow & {
  contentMd: string | null;
};

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [versions, setVersions] = useState<VersionRow[] | null>(null);
  const [selected, setSelected] = useState<Snapshot | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetch(`/api/documents/${id}/versions`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data: { items: VersionRow[] }) => setVersions(data.items))
      .catch(() => setVersions([]));
  }, [id]);

  async function select(versionId: string) {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/documents/${id}/versions/${versionId}`);
      if (res.ok) setSelected((await res.json()) as Snapshot);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function restore(versionId: string) {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/documents/${id}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (res.ok) {
        router.push(`/docs/${id}`);
        return;
      }
      setRestoring(false);
    } catch {
      setRestoring(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/docs/${id}`}
          aria-label="Back to document"
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
          Version history
        </h1>
      </div>

      <div className="flex gap-6">
        <aside className="w-72 shrink-0">
          {versions === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : versions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
              No snapshots yet. Versions appear after the first edit.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => select(v.id)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2.5 text-left shadow-sm",
                      selected?.id === v.id
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-zinc-200 bg-white hover:bg-zinc-50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-900">
                        v{v.version} — {v.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(v.createdAt)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0 flex-1">
          {loadingPreview ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
            </div>
          ) : selected ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <h2 className="truncate text-xl font-semibold tracking-tight text-zinc-900">
                  {selected.title}
                </h2>
                <button
                  type="button"
                  onClick={() => restore(selected.id)}
                  disabled={restoring}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
                >
                  {restoring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Restore
                </button>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                {selected.contentMd?.trim() || (
                  <span className="text-zinc-400">Empty document.</span>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-16 text-center text-sm text-zinc-500">
              Select a version to preview it.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
