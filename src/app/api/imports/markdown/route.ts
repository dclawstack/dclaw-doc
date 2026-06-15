import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { resolveWorkspace } from "@/lib/workspace";
import { markdownToContentJson, parseMarkdownImport } from "@/lib/exporters";
import { reindexDocument } from "@/lib/ai/chunk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  content: z.string().min(1).max(1_000_000),
  title: z.string().trim().max(512).nullish(),
  folderId: z.uuid().nullish(),
  workspaceId: z.uuid().optional(),
});

/** Import a markdown blob as a new document (first H1 / line becomes the title). */
export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");
  const workspace = await resolveWorkspace(user, parsed.data.workspaceId);

  const [parsedTitle, body] = parseMarkdownImport(parsed.data.content);
  const title = parsed.data.title || parsedTitle;
  const contentJson = markdownToContentJson(body);

  const [doc] = await db()
    .insert(documents)
    .values({
      workspaceId: workspace.id,
      folderId: parsed.data.folderId ?? null,
      title,
      contentMd: body,
      contentJson,
      createdBy: user.id,
    })
    .returning();

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.import",
    detail: { format: "markdown", title },
  });

  try {
    await reindexDocument({
      documentId: doc.id,
      workspaceId: workspace.id,
      title,
      contentJson,
      contentMd: body,
    });
  } catch (err) {
    console.error("reindex failed", err);
  }

  return NextResponse.json(doc, { status: 201 });
});
