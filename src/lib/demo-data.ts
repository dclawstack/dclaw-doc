// ============================================================================
// DEMO MODE — safe to delete for production.
// This module seeds/clears a workspace with rich demo content to showcase the
// app. To remove demo mode entirely, delete:
//   - src/lib/demo-data.ts          (this file)
//   - src/app/api/demo/route.ts     (the seed/clear endpoint)
//   - src/components/DemoControls.tsx (the landing-page buttons)
//   - the <DemoControls/> block in src/app/page.tsx
// Nothing else imports these. See DEMO.md.
// ============================================================================
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  comments,
  documentChunks,
  documentVersions,
  documents,
  folders,
  notarizations,
  shareLinks,
  templates,
  aiUsage,
} from "@/db/schema";
import type { Workspace } from "@/lib/workspace";
import { contentHash } from "@/lib/crypto";
import { shareToken } from "@/lib/permissions";
import { markdownToContentJson } from "@/lib/exporters";
import { reindexDocument } from "@/lib/ai/chunk";

type Sens = "public" | "confidential" | "pii" | "phi";
type Status = "draft" | "review" | "approved";

type DemoDoc = {
  folder: string;
  title: string;
  sensitivity: Sens;
  status: Status;
  approve?: boolean;
  share?: boolean;
  comments?: { body: string; resolved?: boolean; replies?: string[] }[];
  text: string;
};

const FOLDERS = ["Contracts", "Clinical Records", "Compliance"];

const DEMO_TEMPLATES = [
  {
    name: "NDA Letter",
    description: "Standard mutual non-disclosure cover letter.",
    contentMd:
      "# Mutual NDA — {{client_name}}\n\nThis agreement is entered into between Acme Health and {{client_name}} (account {{account_id}}).\n\nBoth parties agree to keep confidential information private for a period of {{term_years}} years.",
    variables: [
      { name: "client_name", label: "Client name" },
      { name: "account_id", label: "Account ID" },
      { name: "term_years", label: "Term (years)", default: "3" },
    ],
  },
  {
    name: "Incident Report",
    description: "Security/compliance incident write-up.",
    contentMd:
      "# Incident Report — {{incident_id}}\n\nSeverity: {{severity}}\n\nSummary: {{summary}}\n\nDetection: {{detected_at}}. Resolution and notification handled per policy.",
    variables: [
      { name: "incident_id", label: "Incident ID" },
      { name: "severity", label: "Severity", default: "low" },
      { name: "summary", label: "Summary" },
      { name: "detected_at", label: "Detected at" },
    ],
  },
];

const DEMO_DOCS: DemoDoc[] = [
  {
    folder: "Contracts",
    title: "Vendor Data Processing Agreement",
    sensitivity: "confidential",
    status: "approved",
    approve: true,
    share: true,
    text: `This Data Processing Agreement governs how Acme Health processes personal data on behalf of customers.

The processor shall retain personal data for no longer than 90 days after contract termination, after which all copies are securely deleted.

Sub-processors must be approved in writing. The current approved sub-processors are AWS (hosting) and Twilio (notifications).

Data breaches must be reported to the controller within 24 hours of detection.`,
    comments: [
      {
        body: "Confirm the 90-day retention matches our DPA template.",
        resolved: true,
        replies: ["Verified against the 2026 template — matches."],
      },
      { body: "Should we name the EU sub-processor region here?" },
    ],
  },
  {
    folder: "Clinical Records",
    title: "Patient Onboarding Record — J. Rivera",
    sensitivity: "phi",
    status: "review",
    text: `Patient: Jordan Rivera. DOB: 1991-07-03. Member ID: ACH-220194.

Primary diagnosis: hypertension (ICD-10 I10). Prescribed lisinopril 10mg daily.

Allergies: penicillin. Emergency contact: M. Rivera, +1-555-0148.

Consent for telehealth obtained electronically on 2026-05-02.`,
    comments: [
      { body: "Flagged PHI — confirm encryption-at-rest before approval." },
    ],
  },
  {
    folder: "Clinical Records",
    title: "Care Plan — A. Okafor",
    sensitivity: "phi",
    status: "draft",
    text: `Patient: Amara Okafor. Member ID: ACH-771050.

Care plan: weekly physiotherapy for 8 weeks following ACL reconstruction. Pain managed with ibuprofen as needed.

Follow-up imaging scheduled for 2026-07-15.`,
  },
  {
    folder: "Contracts",
    title: "Twilio Sub-Processor Addendum",
    sensitivity: "confidential",
    status: "draft",
    text: `Acme Health engages Twilio as a sub-processor for SMS and email notifications.

Twilio processes recipient phone numbers and email addresses solely to deliver transactional messages. No message content is retained beyond 30 days.

This addendum is governed by the master Data Processing Agreement.`,
  },
  {
    folder: "Compliance",
    title: "Q2 Compliance Review Summary",
    sensitivity: "public",
    status: "approved",
    approve: true,
    text: `The Q2 compliance review covered access controls, data retention, and incident response.

Access reviews were completed for all 42 employees. Three stale accounts were deactivated.

Data retention policy is enforced automatically; no manual exceptions were granted this quarter.

Two low-severity incidents were logged and resolved within SLA. No reportable breaches occurred.`,
    comments: [
      { body: "Great quarter — share this with the board?", resolved: true },
    ],
  },
  {
    folder: "Compliance",
    title: "Customer PII Handling Policy",
    sensitivity: "pii",
    status: "review",
    text: `Customer personally identifiable information (names, emails, addresses, payment identifiers) is classified as PII and stored encrypted.

Access is restricted to support and billing roles. All access is logged to the immutable audit trail.

PII is retained for the life of the account plus 90 days, then purged automatically.`,
  },
  {
    folder: "Compliance",
    title: "Incident Response Runbook",
    sensitivity: "public",
    status: "draft",
    text: `On detecting a security incident, the on-call engineer opens an incident channel and assigns a severity.

Sev-1 incidents page the security lead immediately. The controller is notified within 24 hours for any breach of personal data.

Post-incident, a write-up is filed and the runbook updated with lessons learned.`,
  },
];

/** True when the workspace already has demo content (any document). */
export async function hasData(workspace: Workspace): Promise<boolean> {
  const rows = await db()
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.workspaceId, workspace.id))
    .limit(1);
  return rows.length > 0;
}

export async function countData(workspace: Workspace) {
  const docs = await db()
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.workspaceId, workspace.id));
  const tpls = await db()
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.workspaceId, workspace.id));
  return { documents: docs.length, templates: tpls.length };
}

/** Wipes all content from the workspace, leaving it (and membership) intact. */
export async function clearWorkspaceData(workspace: Workspace): Promise<void> {
  const ws = workspace.id;
  const docRows = await db()
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.workspaceId, ws));
  const docIds = docRows.map((d) => d.id);

  if (docIds.length > 0) {
    await db().delete(comments).where(inArray(comments.documentId, docIds));
    await db().delete(documentChunks).where(inArray(documentChunks.documentId, docIds));
    await db().delete(documentVersions).where(inArray(documentVersions.documentId, docIds));
    await db().delete(notarizations).where(inArray(notarizations.documentId, docIds));
    await db().delete(shareLinks).where(inArray(shareLinks.documentId, docIds));
  }
  await db().delete(documents).where(eq(documents.workspaceId, ws));
  await db().delete(templates).where(eq(templates.workspaceId, ws));
  await db().delete(folders).where(eq(folders.workspaceId, ws));
  await db().delete(auditEvents).where(eq(auditEvents.workspaceId, ws));
  await db().delete(aiUsage).where(eq(aiUsage.workspaceId, ws));
}

/**
 * Seeds a rich demo dataset: folders, documents across every sensitivity and
 * status, approvals + notarizations, threaded comments, a share link, and
 * templates — all RAG-indexed so the copilot works immediately. Clears first
 * so repeated seeding is idempotent.
 */
export async function seedDemoData(
  workspace: Workspace,
  userId: string
): Promise<{ documents: number; templates: number }> {
  await clearWorkspaceData(workspace);
  const ws = workspace.id;

  // Folders
  const folderIds = new Map<string, string>();
  for (const name of FOLDERS) {
    const [f] = await db()
      .insert(folders)
      .values({ workspaceId: ws, name })
      .returning();
    folderIds.set(name, f.id);
  }

  // Templates
  for (const t of DEMO_TEMPLATES) {
    await db().insert(templates).values({
      workspaceId: ws,
      name: t.name,
      description: t.description,
      contentMd: t.contentMd,
      variablesSchema: t.variables,
    });
  }

  // Documents (+ versions, comments, approval/notarization, share, audit)
  for (const d of DEMO_DOCS) {
    const contentJson = markdownToContentJson(d.text);
    const [doc] = await db()
      .insert(documents)
      .values({
        workspaceId: ws,
        folderId: folderIds.get(d.folder) ?? null,
        title: d.title,
        sensitivity: d.sensitivity,
        status: d.status,
        contentMd: d.text,
        contentJson,
        createdBy: userId,
      })
      .returning();

    await db().insert(documentVersions).values({
      documentId: doc.id,
      version: 1,
      title: d.title,
      contentMd: d.text,
      contentJson,
      createdBy: userId,
    });

    await db().insert(auditEvents).values({
      workspaceId: ws,
      documentId: doc.id,
      actorId: userId,
      action: "document.create",
      detail: { title: d.title, sensitivity: d.sensitivity },
    });

    if (d.approve) {
      const hash = contentHash({
        title: d.title,
        contentMd: d.text,
        contentJson,
        version: 1,
      });
      await db().insert(notarizations).values({
        documentId: doc.id,
        version: 1,
        contentHash: hash,
        createdBy: userId,
      });
      await db().insert(auditEvents).values({
        workspaceId: ws,
        documentId: doc.id,
        actorId: userId,
        action: "document.approve",
        detail: { version: 1, contentHash: hash },
      });
    }

    if (d.share) {
      await db().insert(shareLinks).values({
        documentId: doc.id,
        token: shareToken(),
        permission: "view",
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
        createdBy: userId,
      });
      await db().insert(auditEvents).values({
        workspaceId: ws,
        documentId: doc.id,
        actorId: userId,
        action: "share_link.create",
        detail: { permission: "view" },
      });
    }

    for (const c of d.comments ?? []) {
      const [parent] = await db()
        .insert(comments)
        .values({
          documentId: doc.id,
          body: c.body,
          authorId: userId,
          resolvedAt: c.resolved ? new Date() : null,
        })
        .returning();
      for (const reply of c.replies ?? []) {
        await db().insert(comments).values({
          documentId: doc.id,
          parentId: parent.id,
          body: reply,
          authorId: userId,
        });
      }
    }

    // Index for RAG so the copilot can answer over the demo content.
    try {
      await reindexDocument({
        documentId: doc.id,
        workspaceId: ws,
        title: d.title,
        contentJson,
        contentMd: d.text,
      });
    } catch {
      // AI optional — seeding must not fail if embeddings are unavailable.
    }
  }

  return countData(workspace);
}
