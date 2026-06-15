import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";
import {
  getOwnedTemplate,
  mergeVariables,
  renderTemplate,
  type TemplateVariable,
} from "@/lib/templates";
import { markdownToContentJson } from "@/lib/exporters";
import { reindexDocument } from "@/lib/ai/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  title: z.string().trim().max(500).optional(),
  folderId: z.uuid().nullish(),
  variables: z.record(z.string(), z.string()).default({}),
  workspaceId: z.uuid().optional(),
});

/** Create a document from a template, substituting {{name}} placeholders. */
export const POST = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const workspace = await resolveWorkspace(user, parsed.data.workspaceId);

  const tpl = await getOwnedTemplate(workspace, params.id);
  const tplSchema = Array.isArray(tpl.variablesSchema)
    ? (tpl.variablesSchema as TemplateVariable[])
    : [];
  const merged = mergeVariables(tplSchema, parsed.data.variables);
  const contentMd = renderTemplate(tpl.contentMd, merged);
  const contentJson = markdownToContentJson(contentMd);
  const title = parsed.data.title || tpl.name;

  const [doc] = await db()
    .insert(documents)
    .values({
      workspaceId: workspace.id,
      folderId: parsed.data.folderId ?? null,
      title,
      contentMd,
      contentJson,
      createdBy: user.id,
    })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.create",
    detail: { fromTemplate: tpl.name },
  });

  try {
    await reindexDocument({
      documentId: doc.id,
      workspaceId: workspace.id,
      title,
      contentJson,
      contentMd,
    });
  } catch (err) {
    console.error("reindex failed", err);
  }

  return NextResponse.json(doc, { status: 201 });
});
