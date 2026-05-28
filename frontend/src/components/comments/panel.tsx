"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CommentRecord,
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from "@/lib/api";

interface ThreadNode extends CommentRecord {
  children: ThreadNode[];
}

function toThreads(flat: CommentRecord[]): ThreadNode[] {
  const byId: Record<string, ThreadNode> = {};
  for (const c of flat) byId[c.id] = { ...c, children: [] };
  const roots: ThreadNode[] = [];
  for (const c of flat) {
    const node = byId[c.id];
    if (c.parent_id && byId[c.parent_id]) byId[c.parent_id].children.push(node);
    else roots.push(node);
  }
  return roots;
}

interface Props {
  documentId: string;
}

export function CommentsPanel({ documentId }: Props) {
  const [items, setItems] = useState<CommentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listComments(documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    await createComment(documentId, {
      body,
      parent_id: replyTo ?? undefined,
    });
    setDraft("");
    setReplyTo(null);
    refresh();
  }

  async function handleResolve(comment: CommentRecord) {
    await updateComment(comment.id, { resolved: !comment.resolved_at });
    refresh();
  }

  async function handleDelete(id: string) {
    await deleteComment(id);
    refresh();
  }

  const threads = toThreads(items);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">Error: {error}</p>}
        {loading && items.length === 0 ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-gray-500">
            No comments yet. Start the first thread below.
          </p>
        ) : (
          <ul className="space-y-3">
            {threads.map((root) => (
              <Thread
                key={root.id}
                node={root}
                onReply={(id) => setReplyTo(id)}
                onResolve={handleResolve}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          {replyTo && (
            <p className="text-xs text-gray-500">
              Replying to thread{" "}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-indigo-600 underline"
              >
                cancel
              </button>
            </p>
          )}
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
              aria-label="Comment body"
            />
            <Button type="submit" disabled={!draft.trim()}>
              {replyTo ? "Reply" : "Post"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface ThreadProps {
  node: ThreadNode;
  depth?: number;
  onReply: (commentId: string) => void;
  onResolve: (comment: CommentRecord) => void;
  onDelete: (commentId: string) => void;
}

function Thread({ node, depth = 0, onReply, onResolve, onDelete }: ThreadProps) {
  const isResolved = !!node.resolved_at;
  return (
    <li
      style={{ marginLeft: depth * 16 }}
      className={`rounded border ${isResolved ? "border-gray-100 bg-gray-50" : "border-gray-200 bg-white"} p-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm">
          <p className={isResolved ? "text-gray-500 line-through" : "text-gray-900"}>
            {node.body}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {node.author_id} · {new Date(node.created_at).toLocaleString()}
            {isResolved && " · resolved"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => onReply(node.id)}>
            Reply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onResolve(node)}
          >
            {isResolved ? "Reopen" : "Resolve"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(node.id)}>
            Delete
          </Button>
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-3 space-y-2">
          {node.children.map((child) => (
            <Thread
              key={child.id}
              node={child}
              depth={depth + 1}
              onReply={onReply}
              onResolve={onResolve}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
