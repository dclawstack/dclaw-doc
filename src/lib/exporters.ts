/**
 * Document export + import helpers, ported from the original DClaw Doc
 * exporters service. Dependency-free: the HTML exporter renders a pragmatic
 * markdown subset (headings, bullets, paragraphs), good enough for round-trip,
 * not a CommonMark-compliant renderer.
 */

export type ExportFormat = "md" | "html" | "json";

export type ExportableDoc = {
  id: string;
  workspaceId: string;
  title: string;
  contentMd: string | null;
  contentJson: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportMarkdown(doc: ExportableDoc): string {
  const title = doc.title || "Untitled";
  const body = (doc.contentMd || "").replace(/\s+$/, "");
  return body ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

export function exportHtml(doc: ExportableDoc): string {
  const title = doc.title || "Untitled";
  const lines: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      lines.push("</ul>");
      inList = false;
    }
  };

  for (const raw of (doc.contentMd || "").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line) {
      closeList();
      continue;
    }
    const h = HEADING_RE.exec(line);
    if (h) {
      closeList();
      const level = h[1].length;
      lines.push(`<h${level}>${escapeHtml(h[2])}</h${level}>`);
      continue;
    }
    const b = BULLET_RE.exec(line);
    if (b) {
      if (!inList) {
        lines.push("<ul>");
        inList = true;
      }
      lines.push(`  <li>${escapeHtml(b[1])}</li>`);
      continue;
    }
    closeList();
    lines.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();

  const body = lines.join("\n");
  return (
    "<!doctype html>\n<html><head>" +
    `<meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
    "</head><body>" +
    `<h1>${escapeHtml(title)}</h1>\n${body}` +
    "</body></html>"
  );
}

export function exportJson(doc: ExportableDoc): string {
  return JSON.stringify(
    {
      id: doc.id,
      workspace_id: doc.workspaceId,
      title: doc.title,
      content_md: doc.contentMd,
      content_json: doc.contentJson,
      status: doc.status,
      created_at: doc.createdAt?.toISOString() ?? null,
      updated_at: doc.updatedAt?.toISOString() ?? null,
    },
    null,
    2
  );
}

/**
 * Splits an uploaded markdown blob into [title, body]. Uses the first H1 as the
 * title if present; otherwise the first non-empty line.
 */
export function parseMarkdownImport(text: string): [string, string] {
  let title = "";
  const bodyLines: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!title) {
      if (line.startsWith("# ")) {
        title = line.slice(2).trim();
        continue;
      }
      if (line.trim()) {
        title = line.trim();
      }
    }
    bodyLines.push(line);
  }
  const body = bodyLines.join("\n").trim();
  return [title || "Untitled", body];
}

/** Builds TipTap/ProseMirror JSON from markdown text (paragraphs + headings). */
export function markdownToContentJson(md: string): unknown {
  const blocks = md.split(/\n\s*\n/).filter((b) => b.trim());
  const content = blocks.map((block) => {
    const h = HEADING_RE.exec(block.trim());
    if (h) {
      return {
        type: "heading",
        attrs: { level: Math.min(h[1].length, 6) },
        content: [{ type: "text", text: h[2] }],
      };
    }
    return { type: "paragraph", content: [{ type: "text", text: block.trim() }] };
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}
