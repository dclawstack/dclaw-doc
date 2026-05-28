"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DocRole,
  NotarizationVerify,
  PermissionRecord,
  Sensitivity,
  SharingLinkRecord,
  createSharingLink,
  grantPermission,
  listPermissions,
  listSharingLinks,
  notarizeDocument,
  revokePermission,
  revokeSharingLink,
  setSensitivity,
  verifyNotarization,
} from "@/lib/api";

const ROLES: DocRole[] = ["viewer", "commenter", "editor", "owner"];
const SENSITIVITIES: Sensitivity[] = ["public", "confidential", "pii", "phi"];

interface Props {
  documentId: string;
  initialSensitivity?: Sensitivity;
}

export function SharingCard({ documentId, initialSensitivity = "public" }: Props) {
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [links, setLinks] = useState<SharingLinkRecord[]>([]);
  const [sensitivity, setSens] = useState<Sensitivity>(initialSensitivity);
  const [notarization, setNotarization] = useState<NotarizationVerify | null>(null);

  const [newPrincipal, setNewPrincipal] = useState("");
  const [newRole, setNewRole] = useState<DocRole>("viewer");
  const [linkRole, setLinkRole] = useState<DocRole>("viewer");

  const refresh = useCallback(async () => {
    const [perms, lks, notary] = await Promise.all([
      listPermissions(documentId).catch(() => []),
      listSharingLinks(documentId).catch(() => []),
      verifyNotarization(documentId).catch(() => null),
    ]);
    setPermissions(perms);
    setLinks(lks);
    setNotarization(notary);
  }, [documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function grant() {
    if (!newPrincipal.trim()) return;
    await grantPermission(documentId, {
      principal_type: "user",
      principal_id: newPrincipal.trim(),
      role: newRole,
    });
    setNewPrincipal("");
    refresh();
  }

  async function makeLink() {
    await createSharingLink(documentId, { role: linkRole });
    refresh();
  }

  async function copyLinkToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
    } catch {
      // clipboard unavailable in older browsers — fall through silently
    }
  }

  async function changeSensitivity(value: Sensitivity) {
    setSens(value);
    await setSensitivity(documentId, value);
  }

  async function notarize() {
    await notarizeDocument(documentId);
    refresh();
  }

  const activeLinks = links.filter((l) => !l.revoked_at);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sharing & Compliance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {/* Sensitivity */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Sensitivity
          </h3>
          <div className="flex flex-wrap gap-1">
            {SENSITIVITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => changeSensitivity(s)}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  sensitivity === s
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Notarization */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Notarization
          </h3>
          <div className="flex items-center gap-2">
            {notarization === null ? (
              <Badge variant="outline">Not notarized</Badge>
            ) : notarization.valid ? (
              <Badge>Verified · signature matches</Badge>
            ) : (
              <Badge variant="destructive">Tampered · hash changed</Badge>
            )}
            <Button variant="outline" size="sm" onClick={notarize}>
              Notarize current version
            </Button>
          </div>
        </div>

        {/* People */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            People
          </h3>
          <div className="space-y-1">
            {permissions.filter((p) => p.principal_type === "user").length === 0 && (
              <p className="text-xs text-gray-500">No collaborators granted yet.</p>
            )}
            {permissions
              .filter((p) => p.principal_type === "user")
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded border border-gray-100 px-2 py-1"
                >
                  <span>
                    <span className="font-medium">{p.principal_id}</span>{" "}
                    <span className="text-xs text-gray-500">· {p.role}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await revokePermission(documentId, p.id);
                      refresh();
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newPrincipal}
              onChange={(e) => setNewPrincipal(e.target.value)}
              placeholder="user id or email"
              aria-label="Principal to grant"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as DocRole)}
              className="rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button onClick={grant} disabled={!newPrincipal.trim()}>
              Grant
            </Button>
          </div>
        </div>

        {/* Sharing links */}
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Sharing links
          </h3>
          <div className="space-y-1">
            {activeLinks.length === 0 && (
              <p className="text-xs text-gray-500">No active links.</p>
            )}
            {activeLinks.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1"
              >
                <code
                  title={l.token}
                  className="truncate text-xs text-gray-700"
                  style={{ maxWidth: 240 }}
                >
                  {l.token}
                </code>
                <span className="text-xs text-gray-500">{l.role}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLinkToken(l.token)}>
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await revokeSharingLink(l.id);
                      refresh();
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <select
              value={linkRole}
              onChange={(e) => setLinkRole(e.target.value as DocRole)}
              className="rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Link role"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={makeLink}>
              Create link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
