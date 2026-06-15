"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Folder, FolderOpen, Inbox, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type FolderItem = { id: string; name: string };

export function FolderSidebar({
  folders,
  activeFolderId,
}: {
  folders: FolderItem[];
  activeFolderId?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(id: string) {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (activeFolderId === id) router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <nav aria-label="Folders" className="flex h-full flex-col gap-1">
      <Link
        href="/dashboard"
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
          !activeFolderId
            ? "bg-indigo-50 text-indigo-700"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        )}
      >
        <Inbox className="h-4 w-4 shrink-0" />
        All documents
      </Link>

      {folders.map((folder) => {
        const active = folder.id === activeFolderId;
        return (
          <div
            key={folder.id}
            className={cn(
              "group flex items-center rounded-lg",
              active
                ? "bg-indigo-50 text-indigo-700"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <Link
              href={`/dashboard?folderId=${folder.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm font-medium"
            >
              {active ? (
                <FolderOpen className="h-4 w-4 shrink-0" />
              ) : (
                <Folder className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{folder.name}</span>
            </Link>
            <button
              type="button"
              onClick={() => deleteFolder(folder.id)}
              aria-label={`Delete folder ${folder.name}`}
              className="mr-2 hidden rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 group-hover:block"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      <form onSubmit={createFolder} className="mt-3 flex items-center gap-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New folder"
          aria-label="New folder name"
          className="w-full min-w-0 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          aria-label="Create folder"
          className="shrink-0 rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </nav>
  );
}
