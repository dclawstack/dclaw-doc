import "server-only";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";

export type AuditInput = {
  workspaceId: string;
  documentId?: string | null;
  actorId: string;
  action: string;
  detail?: Record<string, unknown>;
};

/**
 * Appends an event to the audit log. Audit rows are append-only: never
 * update or delete them from application code.
 */
export async function logAudit(input: AuditInput): Promise<void> {
  await db().insert(auditEvents).values({
    workspaceId: input.workspaceId,
    documentId: input.documentId ?? null,
    actorId: input.actorId,
    action: input.action,
    detail: input.detail ?? null,
  });
}
