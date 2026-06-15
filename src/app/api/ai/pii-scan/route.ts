import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import { renderDocText } from "@/lib/render";
import { consensus } from "@/lib/ai/consensus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ documentId: z.uuid() });

const SYSTEM = `You are a compliance classifier. Read the document and decide the highest
sensitivity level present. Reply with EXACTLY one word, no punctuation:
PUBLIC (no personal or sensitive data),
CONFIDENTIAL (internal/business-sensitive but no personal data),
PII (names, emails, addresses, IDs, financial/account data),
PHI (health/medical information about an individual).`;

type Level = "public" | "confidential" | "pii" | "phi";

function parseLevel(raw: string): Level | null {
  const m = raw.toLowerCase().match(/\b(public|confidential|pii|phi)\b/);
  return (m?.[1] as Level) ?? null;
}

/**
 * Compliance-critical: a 2-of-3 consensus across a diverse model panel decides
 * the document's sensitivity, so a single model's miss doesn't mislabel PHI as
 * public. Returns the suggested level + agreement; does not auto-apply.
 */
export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");

  const { workspace, doc } = await getOwnedDocument(user, parsed.data.documentId, req);
  const text = renderDocText(doc.contentJson, doc.contentMd).slice(0, 6000);

  const verdict = await consensus<Level>({
    system: SYSTEM,
    user: `Document title: ${doc.title}\n\n${text || "(empty)"}`,
    parse: parseLevel,
    fallback: "confidential",
    workspaceId: workspace.id,
    purpose: "pii-scan",
  });

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "ai.pii_scan",
    detail: {
      suggested: verdict.decision,
      agreement: verdict.agreement,
      models: verdict.votes.map((v) => ({ model: v.model, value: v.value })),
    },
  });

  return NextResponse.json({
    suggested: verdict.decision,
    agreement: verdict.agreement,
    current: doc.sensitivity,
    votes: verdict.votes.map((v) => ({ model: v.model, value: v.value })),
  });
});
