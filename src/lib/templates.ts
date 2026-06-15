import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { templates } from "@/db/schema";
import type { Workspace } from "@/lib/workspace";
import { httpError } from "@/lib/api";

export type Template = typeof templates.$inferSelect;
export type TemplateVariable = { name: string; label?: string; default?: string };

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Substitutes {{name}} placeholders, leaving unknown placeholders intact. */
export function renderTemplate(
  contentMd: string,
  variables: Record<string, string>
): string {
  return contentMd.replace(PLACEHOLDER_RE, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match
  );
}

/** Merges schema defaults under caller-supplied values. */
export function mergeVariables(
  schema: TemplateVariable[],
  provided: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const entry of schema) {
    if (entry?.name && entry.default != null) merged[entry.name] = String(entry.default);
  }
  for (const [k, v] of Object.entries(provided)) merged[k] = String(v);
  return merged;
}

export async function getOwnedTemplate(
  workspace: Workspace,
  id: string
): Promise<Template> {
  const [tpl] = await db()
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.workspaceId, workspace.id)))
    .limit(1);
  if (!tpl) throw httpError(404, "Template not found");
  return tpl;
}
