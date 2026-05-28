"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TemplatesPicker } from "@/components/templates/picker";
import { WorkspaceSwitcher } from "@/components/workspace/switcher";
import {
  DocumentRecord,
  createDocument,
  deleteDocument,
  listDocuments,
} from "@/lib/api";

export default function Home() {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDocuments({ q });
      setDocs(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await createDocument({ title: newTitle.trim() });
    setNewTitle("");
    await refresh(query || undefined);
  }

  async function handleDelete(id: string) {
    await deleteDocument(id);
    await refresh(query || undefined);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold">DClaw Doc</h1>
            <p className="text-sm text-gray-600">
              AI-native document workspace · backend on :8107
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-indigo-600">
            <WorkspaceSwitcher />
            <div className="flex gap-4">
              <Link href="/usage" className="hover:underline">
                AI usage →
              </Link>
              <Link href="/jobs" className="hover:underline">
                Jobs →
              </Link>
              <Link href="/ocr" className="hover:underline">
                OCR →
              </Link>
            </div>
          </div>
        </header>

        <TemplatesPicker />

        <Card>
          <CardHeader>
            <CardTitle>New document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Untitled doc"
                aria-label="New document title"
              />
              <Button type="submit" disabled={!newTitle.trim()}>
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Documents ({total})</CardTitle>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                refresh(e.target.value || undefined);
              }}
              placeholder="Search titles…"
              className="max-w-xs"
              aria-label="Search documents"
            />
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-3 text-sm text-red-600">Error: {error}</p>
            )}
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-gray-500">
                No documents yet. Create your first one above.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <Link
                          href={`/docs/${doc.id}`}
                          className="font-medium text-indigo-600 hover:underline"
                        >
                          {doc.title}
                        </Link>
                      </TableCell>
                      <TableCell>{doc.status}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(doc.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(doc.id)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
