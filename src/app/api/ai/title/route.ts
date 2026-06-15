import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { httpError, withErrors } from "@/lib/api";
import { getOwnedDocument } from "@/lib/documents";
import { renderDocText } from "@/lib/render";
import { chat } from "@/lib/ai/openrouter";
import { MODELS } from "@/lib/ai/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ documentId: z.uuid() });

/** Cheap-model title suggestion from the document body. */
export const POST = withErrors(async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw httpError(400, "Invalid request body");

  const { workspace, doc } = await getOwnedDocument(user, parsed.data.documentId, req);
  const text = renderDocText(doc.contentJson, doc.contentMd).slice(0, 2000);
  if (!text) return NextResponse.json({ title: null });

  const title = await chat({
    model: MODELS.cheap,
    messages: [
      {
        role: "system",
        content:
          "Suggest a concise, specific document title (max 8 words). Reply with the title only, no quotes.",
      },
      { role: "user", content: text },
    ],
    temperature: 0.3,
    maxTokens: 30,
    workspaceId: workspace.id,
    purpose: "title",
  });

  return NextResponse.json({ title: title.trim().replace(/^["']|["']$/g, "") });
});
