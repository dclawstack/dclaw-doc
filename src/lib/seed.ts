import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import type { Workspace } from "@/lib/workspace";
import { reindexDocument } from "@/lib/ai/chunk";

type Seed = {
  title: string;
  sensitivity: "public" | "confidential" | "pii" | "phi";
  text: string;
};

const SEEDS: Seed[] = [
  {
    title: "Vendor Data Processing Agreement",
    sensitivity: "confidential",
    text: `This Data Processing Agreement governs how Acme Health processes personal data on behalf of customers.

The processor shall retain personal data for no longer than 90 days after contract termination, after which all copies are securely deleted.

Sub-processors must be approved in writing. The current approved sub-processors are AWS (hosting) and Twilio (notifications).

Data breaches must be reported to the controller within 24 hours of detection.`,
  },
  {
    title: "Patient Onboarding Record — J. Rivera",
    sensitivity: "phi",
    text: `Patient: Jordan Rivera. DOB: 1991-07-03. Member ID: ACH-220194.

Primary diagnosis: hypertension (ICD-10 I10). Prescribed lisinopril 10mg daily.

Allergies: penicillin. Emergency contact: M. Rivera, +1-555-0148.

Consent for telehealth obtained electronically on 2026-05-02.`,
  },
  {
    title: "Q2 Compliance Review Summary",
    sensitivity: "public",
    text: `The Q2 compliance review covered access controls, data retention, and incident response.

Access reviews were completed for all 42 employees. Three stale accounts were deactivated.

Data retention policy is enforced automatically; no manual exceptions were granted this quarter.

Two low-severity incidents were logged and resolved within SLA. No reportable breaches occurred.`,
  },
];

/**
 * Seeds a fresh workspace with demo documents (and indexes them for RAG) the
 * first time it's used, so the dashboard and copilot have real content to show.
 * Idempotent: does nothing if the workspace already has documents.
 */
export async function seedWorkspaceIfEmpty(workspace: Workspace, userId: string) {
  const existing = await db()
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.workspaceId, workspace.id), isNull(documents.deletedAt)))
    .limit(1);
  if (existing.length > 0) return;

  for (const seed of SEEDS) {
    const contentJson = {
      type: "doc",
      content: seed.text.split(/\n\s*\n/).map((para) => ({
        type: "paragraph",
        content: [{ type: "text", text: para.trim() }],
      })),
    };
    const [doc] = await db()
      .insert(documents)
      .values({
        workspaceId: workspace.id,
        title: seed.title,
        sensitivity: seed.sensitivity,
        contentJson,
        contentMd: seed.text,
        createdBy: userId,
      })
      .returning();

    try {
      await reindexDocument({
        documentId: doc.id,
        workspaceId: workspace.id,
        title: seed.title,
        contentJson,
        contentMd: seed.text,
      });
    } catch {
      // AI optional; seeding must not fail if embeddings are unavailable.
    }
  }
}
