"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DocumentRecord,
  deleteDocument,
  getDocument,
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

  const load = useCallback(async () => {
    try {
      const fetched = await getDocument(id);
      setDoc(fetched);
      setTitle(fetched.title);
      setContent(fetched.content_md);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateDocument(id, { title, content_md: content });
      setDoc(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
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
      </div>
    </main>
  );
}
