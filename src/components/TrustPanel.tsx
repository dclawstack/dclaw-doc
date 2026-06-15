"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Copy,
  Loader2,
  Lock,
  ScrollText,
  ShieldCheck,
  Share2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SensitivityBadge, type Sensitivity } from "@/components/SensitivityBadge";
import { formatDate } from "@/lib/format";

type ShareLink = {
  id: string;
  token: string;
  permission: "view" | "edit";
  expiresAt: string | null;
  revokedAt: string | null;
};

type Notarization = {
  id: string;
  version: number;
  contentHash: string;
  createdAt: string;
  verifiedAgainstCurrent: boolean;
};

type AuditEvent = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

const SENSITIVITIES: Sensitivity[] = ["public", "confidential", "pii", "phi"];

export function TrustPanel({
  docId,
  sensitivity,
  status,
  onStatusChange,
  onSensitivityChange,
  refreshKey,
}: {
  docId: string;
  sensitivity: Sensitivity;
  status: string;
  onStatusChange: (status: string) => void;
  onSensitivityChange: (s: Sensitivity) => void;
  refreshKey: number;
}) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [notarizations, setNotarizations] = useState<Notarization[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, n, a] = await Promise.all([
      fetch(`/api/documents/${docId}/share-links`).then((r) => r.json()),
      fetch(`/api/documents/${docId}/notarizations`).then((r) => r.json()),
      fetch(`/api/audit?documentId=${docId}&limit=12`).then((r) => r.json()),
    ]);
    setLinks(l.items ?? []);
    setNotarizations(n.items ?? []);
    setAudit(a.items ?? []);
  }, [docId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function setSensitivity(s: Sensitivity) {
    onSensitivityChange(s);
    await fetch(`/api/documents/${docId}/sensitivity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitivity: s }),
    });
    load();
  }

  async function approve() {
    setBusy("approve");
    const res = await fetch(`/api/documents/${docId}/approve`, { method: "POST" });
    if (res.ok) onStatusChange("approved");
    setBusy(null);
    load();
  }

  async function createLink() {
    setBusy("link");
    await fetch(`/api/documents/${docId}/share-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission: "view", expiresInDays: 7 }),
    });
    setBusy(null);
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/share-links/${id}`, { method: "DELETE" });
    load();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  }

  const activeLinks = links.filter((l) => !l.revokedAt);
  const latestNotary = notarizations[0];

  return (
    <aside className="w-full space-y-6 text-sm">
      <Section icon={<Lock className="h-4 w-4" />} title="Sensitivity">
        <div className="flex flex-wrap gap-1.5">
          {SENSITIVITIES.map((s) => (
            <button
              key={s}
              onClick={() => setSensitivity(s)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition",
                s === sensitivity
                  ? "ring-2 ring-indigo-400"
                  : "opacity-70 hover:opacity-100"
              )}
            >
              <SensitivityBadge sensitivity={s} />
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<BadgeCheck className="h-4 w-4" />} title="Approval & notarization">
        {latestNotary ? (
          <div className="space-y-1.5">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
                latestNotary.verifiedAgainstCurrent
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {latestNotary.verifiedAgainstCurrent
                ? "Verified — content matches approval"
                : "Edited since last approval"}
            </div>
            <p className="break-all font-mono text-[11px] text-zinc-400">
              {latestNotary.contentHash.slice(0, 32)}…
            </p>
            <p className="text-xs text-zinc-400">
              v{latestNotary.version} · {formatDate(latestNotary.createdAt)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">Not yet approved.</p>
        )}
        <button
          onClick={approve}
          disabled={busy === "approve"}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {status === "approved" ? "Re-approve & notarize" : "Approve & notarize"}
        </button>
      </Section>

      <Section icon={<Share2 className="h-4 w-4" />} title="Share links">
        {activeLinks.length === 0 && (
          <p className="text-xs text-zinc-400">No active links.</p>
        )}
        <ul className="space-y-1.5">
          {activeLinks.map((l) => (
            <li
              key={l.id}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5"
            >
              <span className="truncate font-mono text-[11px] text-zinc-500">
                /share/{l.token.slice(0, 10)}…
              </span>
              <span className="ml-auto text-[11px] text-zinc-400">
                {l.expiresAt ? `exp ${formatDate(l.expiresAt)}` : "no expiry"}
              </span>
              <button
                onClick={() => copyLink(l.token)}
                aria-label="Copy link"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => revoke(l.id)}
                aria-label="Revoke link"
                className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {copied && (
          <p className="mt-1 text-[11px] text-emerald-600">Link copied.</p>
        )}
        <button
          onClick={createLink}
          disabled={busy === "link"}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
        >
          {busy === "link" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          New 7-day link
        </button>
      </Section>

      <Section icon={<ScrollText className="h-4 w-4" />} title="Activity">
        <ul className="space-y-2">
          {audit.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
              <div>
                <span className="font-medium text-zinc-700">
                  {e.action.replace(/[._]/g, " ")}
                </span>
                <span className="block text-[11px] text-zinc-400">
                  {formatDate(e.createdAt)}
                </span>
              </div>
            </li>
          ))}
          {audit.length === 0 && (
            <li className="text-xs text-zinc-400">No activity yet.</li>
          )}
        </ul>
      </Section>
    </aside>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
