"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import { DocTable, type DocRow } from "@/components/DocTable";

export function DashboardDocs({
  initialItems,
  initialTotal,
  folderId,
}: {
  initialItems: DocRow[];
  initialTotal: number;
  folderId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DocRow[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync when the server re-renders (folder change, refresh).
  useEffect(() => {
    setItems(initialItems);
    setTotal(initialTotal);
    setQuery("");
  }, [initialItems, initialTotal, folderId]);

  function onSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = value.trim();
      if (!q) {
        setItems(initialItems);
        setTotal(initialTotal);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const params = new URLSearchParams({ q, limit: "50" });
        if (folderId) params.set("folderId", folderId);
        const res = await fetch(`/api/documents?${params.toString()}`);
        if (res.ok) {
          const data: { items: DocRow[]; total: number } = await res.json();
          setItems(data.items);
          setTotal(data.total);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function createDocument() {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(folderId ? { folderId } : {}),
      });
      if (res.ok) {
        const doc: { id: string } = await res.json();
        router.push(`/docs/${doc.id}`);
        return;
      }
      setCreating(false);
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
          )}
        </div>
        <button
          type="button"
          onClick={createDocument}
          disabled={creating}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          New document
        </button>
      </div>

      <DocTable
        items={items}
        emptyMessage={
          query.trim()
            ? "No documents match your search."
            : "No documents yet. Create your first one."
        }
      />
      <p className="text-xs text-zinc-400">
        {total} document{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
