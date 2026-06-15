"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, Trash2, Wand2 } from "lucide-react";

type Variable = { name: string; label?: string; default?: string };
type Template = {
  id: string;
  name: string;
  description: string | null;
  contentMd: string;
  variablesSchema: Variable[];
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Template | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-zinc-500">
            Reusable documents with <code className="text-xs">{"{{variables}}"}</code> you fill in on use.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 py-16 text-center text-sm text-zinc-400">
          No templates yet. Create one to speed up repetitive documents.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex flex-col rounded-xl border border-zinc-200 p-4 shadow-sm"
            >
              <div className="mb-1 flex items-start gap-2">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
                <h3 className="font-medium text-zinc-900">{t.name}</h3>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Delete template"
                  className="ml-auto rounded p-1 text-zinc-300 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {t.description && (
                <p className="mb-3 text-sm text-zinc-500">{t.description}</p>
              )}
              <div className="mb-3 flex flex-wrap gap-1">
                {t.variablesSchema.map((v) => (
                  <span
                    key={v.name}
                    className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500"
                  >
                    {v.name}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setActive(t)}
                className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Use template
              </button>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <CreateTemplateModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {active && (
        <RenderTemplateModal
          template={active}
          onClose={() => setActive(null)}
          onRendered={(docId) => router.push(`/docs/${docId}`)}
        />
      )}
    </div>
  );
}

function CreateTemplateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Variables are inferred from {{name}} placeholders in the body.
  const variables = Array.from(
    new Set(
      Array.from(contentMd.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)).map((m) => m[1])
    )
  ).map((n) => ({ name: n }));

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, contentMd, variables }),
    });
    setBusy(false);
    if (res.ok) onCreated();
    else setError((await res.json()).error ?? "Failed to create");
  }

  return (
    <Modal title="New template" onClose={onClose}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Template name"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />
      <textarea
        value={contentMd}
        onChange={(e) => setContentMd(e.target.value)}
        placeholder={"Body — use {{variable}} placeholders.\n\nExample:\nDear {{client_name}}, your account {{account_id}} is confirmed."}
        rows={8}
        className="w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs focus:border-indigo-400 focus:outline-none"
      />
      {variables.length > 0 && (
        <p className="text-xs text-zinc-400">
          Detected variables: {variables.map((v) => v.name).join(", ")}
        </p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create
        </button>
      </div>
    </Modal>
  );
}

function RenderTemplateModal({
  template,
  onClose,
  onRendered,
}: {
  template: Template;
  onClose: () => void;
  onRendered: (docId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.variablesSchema.map((v) => [v.name, v.default ?? ""]))
  );
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/templates/${template.id}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title || undefined, variables: values }),
    });
    setBusy(false);
    if (res.ok) onRendered((await res.json()).id);
  }

  return (
    <Modal title={`Use "${template.name}"`} onClose={onClose}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Document title (default: ${template.name})`}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
      />
      {template.variablesSchema.map((v) => (
        <div key={v.name}>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            {v.label ?? v.name}
          </label>
          <input
            value={values[v.name] ?? ""}
            onChange={(e) => setValues((s) => ({ ...s, [v.name]: e.target.value }))}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
          />
        </div>
      ))}
      {template.variablesSchema.length === 0 && (
        <p className="text-xs text-zinc-400">This template has no variables.</p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create document
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-900/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
