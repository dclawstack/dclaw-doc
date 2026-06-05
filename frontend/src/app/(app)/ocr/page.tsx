"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ocrToDocument, ocrTranscribe } from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // strip the `data:image/png;base64,` prefix
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function OCRPage() {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [b64, setB64] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [providerInfo, setProviderInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setText(null);
    setPreview(URL.createObjectURL(file));
    setB64(await fileToBase64(file));
    if (!docTitle) setDocTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function runScan() {
    if (!b64) return;
    setBusy(true);
    setError(null);
    try {
      const res = await ocrTranscribe(b64, hint.trim() || undefined);
      setText(res.text);
      setProviderInfo(`${res.provider} · ${res.model}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAsDocument() {
    if (!b64 || !docTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const doc = await ocrToDocument(b64, docTitle.trim(), hint.trim() || undefined);
      router.push(`/docs/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">OCR / Vision</h1>
            <p className="text-sm text-gray-600">
              Upload an image; transcribe to text and optionally save as a document.
            </p>
          </div>
          <Link href="/dashboard" className="text-sm text-indigo-600 hover:underline">
            ← Dashboard
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Upload an image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label htmlFor="ocr-file">Image (PNG / JPG)</Label>
              <input
                id="ocr-file"
                type="file"
                accept="image/*"
                aria-label="Image (PNG / JPG)"
                onChange={onFile}
                className="block text-sm file:mr-3 file:rounded file:border file:border-gray-200 file:bg-white file:px-3 file:py-1 file:text-sm"
              />
            </div>

            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Selected"
                className="max-h-64 rounded border border-gray-200"
              />
            )}

            <div className="space-y-1">
              <Label htmlFor="ocr-hint">Hint (optional)</Label>
              <Input
                id="ocr-hint"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                placeholder='e.g. "invoice", "handwritten note"'
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={runScan} disabled={!b64 || busy}>
                {busy ? "Scanning…" : "Transcribe"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {text && (
          <Card>
            <CardHeader>
              <CardTitle>
                Transcript
                {providerInfo && (
                  <span className="ml-2 text-xs text-gray-500">{providerInfo}</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 text-xs">
                {text}
              </pre>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="ocr-doc-title">Document title</Label>
                  <Input
                    id="ocr-doc-title"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                </div>
                <Button onClick={saveAsDocument} disabled={busy || !docTitle.trim()}>
                  Save as document
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {error && <p className="text-sm text-red-600">Error: {error}</p>}
      </div>
    </main>
  );
}
