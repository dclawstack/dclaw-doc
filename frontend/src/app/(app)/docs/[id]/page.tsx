"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CommentsPanel } from "@/components/comments/panel";
import { PIIChip } from "@/components/compliance/pii-chip";
import { AgentPanel } from "@/components/copilot/agent-panel";
import { CopilotPanel } from "@/components/copilot/panel";
import { CollabRichEditor } from "@/components/editor/collab-editor";
import { RichEditor } from "@/components/editor/rich-editor";
import { ESignCard } from "@/components/esign/esign-card";
import { MergeModal } from "@/components/merge/merge-modal";
import { SharingCard } from "@/components/sharing/sharing-card";
import { TranslationModal } from "@/components/translation/modal";
import { DiffViewer } from "@/components/versions/diff-viewer";
import {
  DocumentRecord,
  DocumentVersionSummary,
  deleteDocument,
  getDocument,
  listDocumentVersions,
  restoreDocumentVersion,
  updateDocument,
} from "@/lib/api";

const AUTOSAVE_DEBOUNCE_MS = 1200;
const COLLAB_ENABLED = process.env.NEXT_PUBLIC_COLLAB === "true";

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [initialContent, setInitialContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autosaveAt, setAutosaveAt] = useState<Date | null>(null);
  const [versions, setVersions] = useState<DocumentVersionSummary[]>([]);
  const [diffVersion, setDiffVersion] = useState<number | null>(null);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setInitialContent(fetched.content_md);
      await loadVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id, loadVersions]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: { title: string; content_md: string }) => {
      setSaving(true);
      try {
        const updated = await updateDocument(id, next);
        setDoc(updated);
        setAutosaveAt(new Date());
        await loadVersions();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [id, loadVersions],
  );

  // Autosave whenever title/content change after the initial load.
  useEffect(() => {
    if (!doc) return;
    if (title === doc.title && content === doc.content_md) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      save({ title, content_md: content });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, content, doc, save]);

  async function handleRestore(versionNum: number) {
    const restored = await restoreDocumentVersion(id, versionNum);
    setDoc(restored);
    setTitle(restored.title);
    setContent(restored.content_md);
    setInitialContent(restored.content_md);
    await loadVersions();
  }

  async function handleDelete() {
    await deleteDocument(id);
    router.push("/dashboard");
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-sm text-red-600">Error: {error}</p>
          <Link href="/dashboard" className="text-indigo-600 hover:underline">
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
        <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
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
            {COLLAB_ENABLED && doc.workspace_id ? (
              <CollabRichEditor
                documentId={id}
                workspaceId={doc.workspace_id}
                initialMarkdown={initialContent}
                onChange={setContent}
                ariaLabel="Document content editor"
              />
            ) : (
              <RichEditor
                initialMarkdown={initialContent}
                onChange={setContent}
                ariaLabel="Document content editor"
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" onClick={handleDelete}>
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setTranslateOpen(true)}>
                  Translate
                </Button>
                <Button variant="outline" onClick={() => setMergeOpen(true)}>
                  Resolve offline edits
                </Button>
                <PIIChip text={content} />
              </div>
              <p className="text-xs text-gray-500">
                {saving
                  ? "Saving…"
                  : autosaveAt
                  ? `Autosaved ${autosaveAt.toLocaleTimeString()}`
                  : `Last updated ${new Date(doc.updated_at).toLocaleString()}`}
              </p>
            </div>
          </CardContent>
        </Card>

        <SharingCard documentId={id} initialSensitivity={doc.sensitivity} />

        <ESignCard documentId={id} />

        <CommentsPanel documentId={id} />

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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDiffVersion(v.version_num)}
                      >
                        Diff
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(v.version_num)}
                      >
                        Restore
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <AgentPanel />
      </div>

      {diffVersion !== null && (
        <DiffViewer
          documentId={id}
          versionNum={diffVersion}
          currentTitle={title}
          currentContent={content}
          onClose={() => setDiffVersion(null)}
        />
      )}

      {translateOpen && (
        <TranslationModal
          documentId={id}
          onClose={() => setTranslateOpen(false)}
          onApplied={(newMd) => {
            setContent(newMd);
            setInitialContent(newMd);
          }}
        />
      )}

      {mergeOpen && (
        <MergeModal
          documentId={id}
          currentContent={content}
          onClose={() => setMergeOpen(false)}
          onApplied={(mergedMd) => {
            setContent(mergedMd);
            setInitialContent(mergedMd);
          }}
        />
      )}
    </main>
  );
}
