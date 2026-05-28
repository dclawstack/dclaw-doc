"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopilotPanel } from "@/components/copilot/panel";
import {
  DocumentRecord,
  DocumentVersionSummary,
  deleteDocument,
  getDocument,
  listDocumentVersions,
  restoreDocumentVersion,
  updateDocument,
} from "@/lib/api";

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await listDocumentVersions(id));
    } catch {
      // versions feature flag may be off — silently skip
    }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const fetched = await getDocument(id);
      setDoc(fetched);
      setTitle(fetched.title);
      setContent(fetched.content_md);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id, loadVersions]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateDocument(id, { title, content_md: content });
      setDoc(updated);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(versionNum: number) {
    const restored = await restoreDocumentVersion(id, versionNum);
    setDoc(restored);
    setTitle(restored.title);
    setContent(restored.content_md);
    await loadVersions();
  }

  async function handleDelete() {
    await deleteDocument(id);
    router.push("/");
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-red-600">Error: {error}</p>
          <Link href="/" className="text-indigo-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  if (!doc) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <p className="mx-auto max-w-3xl text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Back to dashboard
        </Link>

        <CopilotPanel documentId={id} />

        <Card>
          <CardHeader>
            <CardTitle>Edit document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              aria-label="Title"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Markdown content…"
              className="min-h-[300px] w-full rounded-md border border-input bg-background p-3 text-sm font-mono"
              aria-label="Content"
            />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={handleDelete}>
                Delete
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Last updated {new Date(doc.updated_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>

        {versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {versions.map((v) => (
                  <li
                    key={v.version_num}
                    className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">v{v.version_num}</span>
                      <span className="ml-2 text-gray-700">{v.title}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestore(v.version_num)}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
