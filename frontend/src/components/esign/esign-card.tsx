"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SignRequestRecord, createSignRequest, listSignRequests } from "@/lib/api";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  sent: "secondary",
  viewed: "secondary",
  signed: "default",
  declined: "destructive",
  expired: "destructive",
};

interface Props {
  documentId: string;
}

export function ESignCard({ documentId }: Props) {
  const [items, setItems] = useState<SignRequestRecord[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listSignRequests(documentId));
    } catch {
      // feature may be unwired in this deployment
    }
  }, [documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createSignRequest(documentId, {
        signer_email: email.trim(),
        signer_name: name.trim() || undefined,
      });
      setEmail("");
      setName("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signatures</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {items.length === 0 ? (
          <p className="text-xs text-gray-500">No signature requests yet.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2"
              >
                <div>
                  <p>{r.signer_name ? `${r.signer_name} <${r.signer_email}>` : r.signer_email}</p>
                  <p className="text-xs text-gray-500">
                    {r.provider} · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="signer@example.com"
              aria-label="Signer email"
              required
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="signer name (optional)"
              aria-label="Signer name"
            />
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">Error: {error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
