import { requireUser } from "@/lib/auth";
import { withErrors } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getOwnedDocument } from "@/lib/documents";
import {
  exportHtml,
  exportJson,
  exportMarkdown,
  type ExportFormat,
} from "@/lib/exporters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAFE: Record<ExportFormat, { type: string; ext: string }> = {
  md: { type: "text/markdown; charset=utf-8", ext: "md" },
  html: { type: "text/html; charset=utf-8", ext: "html" },
  json: { type: "application/json", ext: "json" },
};

export const GET = withErrors(async (req, { params }) => {
  const user = await requireUser();
  const { workspace, doc } = await getOwnedDocument(user, params.id, req);

  const fmtParam = (new URL(req.url).searchParams.get("fmt") ?? "md") as ExportFormat;
  const fmt: ExportFormat = fmtParam in SAFE ? fmtParam : "md";

  const exportable = {
    id: doc.id,
    workspaceId: doc.workspaceId,
    title: doc.title,
    contentMd: doc.contentMd,
    contentJson: doc.contentJson,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  const body =
    fmt === "md"
      ? exportMarkdown(exportable)
      : fmt === "html"
        ? exportHtml(exportable)
        : exportJson(exportable);

  await logAudit({
    workspaceId: workspace.id,
    documentId: doc.id,
    actorId: user.id,
    action: "document.export",
    detail: { format: fmt },
  });

  const slug = (doc.title || "document").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(body, {
    headers: {
      "Content-Type": SAFE[fmt].type,
      "Content-Disposition": `attachment; filename="${slug}.${SAFE[fmt].ext}"`,
    },
  });
});
