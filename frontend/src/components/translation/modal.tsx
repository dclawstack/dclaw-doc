"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { translateDocument } from "@/lib/api";

interface GlossaryEntry {
  term: string;
  to: string;
}

interface Props {
  documentId: string;
  onClose: () => void;
  onApplied?: (newContentMd: string) => void;
}

export function TranslationModal({ documentId, onClose, onApplied }: Props) {
  const [language, setLanguage] = useState("French");
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setGlossary((g) => [...g, { term: "", to: "" }]);
  }

  function updateRow(idx: number, field: "term" | "to", value: string) {
    setGlossary((g) => g.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function removeRow(idx: number) {
    setGlossary((g) => g.filter((_, i) => i !== idx));
  }

  function glossaryDict(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of glossary) {
      if (row.term.trim() && row.to.trim()) out[row.term.trim()] = row.to.trim();
    }
    return out;
  }

  async function runPreview() {
    setBusy(true);
    setError(null);
    try {
      const result = await translateDocument(documentId, {
        target_language: language,
        glossary: glossaryDict(),
        in_place: false,
      });
      setPreview(result.content_md);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function applyInPlace() {
    setBusy(true);
    setError(null);
    try {
      const result = await translateDocument(documentId, {
        target_language: language,
        glossary: glossaryDict(),
        in_place: true,
      });
      onApplied?.(result.content_md);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Translate document"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold">Translate document</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-auto p-4 text-sm">
          <div className="space-y-1">
            <Label htmlFor="translate-language">Target language</Label>
            <Input
              id="translate-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. French, Spanish, Japanese"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Glossary
              </h3>
              <Button variant="ghost" size="sm" onClick={addRow}>
                + Add term
              </Button>
            </div>
            {glossary.length === 0 ? (
              <p className="text-xs text-gray-500">
                Optional — force specific translations for brand terms.
              </p>
            ) : (
              <ul className="space-y-1">
                {glossary.map((row, idx) => (
                  <li key={idx} className="flex gap-2">
                    <Input
                      value={row.term}
                      onChange={(e) => updateRow(idx, "term", e.target.value)}
                      placeholder="source term"
                    />
                    <Input
                      value={row.to}
                      onChange={(e) => updateRow(idx, "to", e.target.value)}
                      placeholder="forced translation"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeRow(idx)}>
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">Error: {error}</p>}

          {preview && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Preview
              </h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs">
                {preview}
              </pre>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button variant="outline" onClick={runPreview} disabled={busy || !language.trim()}>
            {busy ? "Translating…" : "Preview"}
          </Button>
          <Button onClick={applyInPlace} disabled={busy || !language.trim()}>
            Apply in place
          </Button>
        </footer>
      </div>
    </div>
  );
}
