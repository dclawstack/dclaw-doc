"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CornerDownRight, Loader2, Send, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";

type Comment = {
  id: string;
  parentId: string | null;
  body: string;
  authorId: string;
  resolvedAt: string | null;
  createdAt: string;
};

export function CommentsPanel({ docId }: { docId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${docId}/comments`);
    const data = await res.json();
    setComments(data.items ?? []);
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    await fetch(`/api/documents/${docId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text, parentId: replyTo }),
    });
    setBody("");
    setReplyTo(null);
    setBusy(false);
    load();
  }

  async function toggleResolve(c: Comment) {
    await fetch(`/api/comments/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !c.resolvedAt }),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/comments/${id}`, { method: "DELETE" });
    load();
  }

  const roots = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Comments
      </h3>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {roots.length === 0 && (
          <p className="text-xs text-zinc-400">No comments yet.</p>
        )}
        {roots.map((c) => (
          <div key={c.id} className="space-y-2">
            <CommentItem
              c={c}
              onResolve={() => toggleResolve(c)}
              onReply={() => setReplyTo(c.id)}
              onDelete={() => remove(c.id)}
            />
            {repliesOf(c.id).map((r) => (
              <div key={r.id} className="ml-4 border-l border-zinc-100 pl-3">
                <CommentItem
                  c={r}
                  onResolve={() => toggleResolve(r)}
                  onDelete={() => remove(r.id)}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 border-t border-zinc-100 pt-3"
      >
        {replyTo && (
          <div className="mb-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
            <CornerDownRight className="h-3 w-3" /> replying
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-1 text-indigo-500 hover:underline"
            >
              cancel
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm focus:border-indigo-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !body.trim()}
            aria-label="Post comment"
            className="rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function CommentItem({
  c,
  onResolve,
  onReply,
  onDelete,
}: {
  c: Comment;
  onResolve?: () => void;
  onReply?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-sm ${
        c.resolvedAt ? "border-zinc-100 bg-zinc-50 opacity-70" : "border-zinc-200"
      }`}
    >
      <p className="whitespace-pre-wrap text-zinc-700">{c.body}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
        <span>{c.authorId}</span>
        <span>·</span>
        <span>{formatDate(c.createdAt)}</span>
        {c.resolvedAt && <span className="text-emerald-600">· resolved</span>}
        <div className="ml-auto flex items-center gap-1">
          {onReply && (
            <button onClick={onReply} className="hover:text-zinc-700">
              reply
            </button>
          )}
          {onResolve && (
            <button
              onClick={onResolve}
              aria-label="Toggle resolved"
              className="rounded p-0.5 hover:bg-emerald-50 hover:text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            aria-label="Delete comment"
            className="rounded p-0.5 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
