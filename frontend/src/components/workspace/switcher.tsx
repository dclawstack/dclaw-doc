"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  WorkspaceRecord,
  createWorkspace,
  getActiveWorkspaceId,
  listWorkspaces,
  setActiveWorkspaceId,
} from "@/lib/api";

/**
 * Workspace switcher / creator.
 *
 * Persists the active workspace id in localStorage; the API client reads
 * it on every request via X-Workspace-Id. Picking the "personal"
 * workspace (always available) makes the fallback path implicit again.
 */
export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listWorkspaces();
      setWorkspaces(list);
      const stored = getActiveWorkspaceId();
      // Default to the personal workspace if nothing's stored.
      if (!stored) {
        const personal = list.find((w) => w.slug === "personal") ?? list[0];
        if (personal) {
          setActiveWorkspaceId(personal.id);
          setActive(personal.id);
        }
      } else {
        setActive(stored);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function pick(id: string) {
    setActiveWorkspaceId(id);
    setActive(id);
    setOpen(false);
    // Force a refresh of the page so all data-fetching components see
    // the new workspace context.
    if (typeof window !== "undefined") window.location.reload();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newSlug.trim() || !newName.trim()) return;
    setError(null);
    try {
      const ws = await createWorkspace({
        slug: newSlug.trim().toLowerCase(),
        name: newName.trim(),
      });
      setNewSlug("");
      setNewName("");
      setCreating(false);
      await refresh();
      pick(ws.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {activeWs ? activeWs.name : "Workspace…"}
        <span aria-hidden="true" className="ml-2 text-xs text-gray-400">
          ▼
        </span>
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <ul className="max-h-48 overflow-auto py-1 text-sm">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => pick(w.id)}
                  className={`block w-full px-3 py-1.5 text-left hover:bg-gray-50 ${
                    w.id === activeId ? "bg-indigo-50 font-medium text-indigo-700" : ""
                  }`}
                >
                  {w.name}
                  <span className="ml-2 text-xs text-gray-400">{w.slug}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-100 p-2">
            {!creating ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setCreating(true)}
              >
                + New workspace
              </Button>
            ) : (
              <form onSubmit={handleCreate} className="space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="ws-slug">Slug</Label>
                  <Input
                    id="ws-slug"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="acme"
                    pattern="^[a-z0-9][a-z0-9-]*$"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ws-name">Name</Label>
                  <Input
                    id="ws-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Acme Co"
                    required
                  />
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreating(false);
                      setError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Create
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
