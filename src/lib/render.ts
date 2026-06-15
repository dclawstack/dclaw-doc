/**
 * Extracts plain text from a TipTap/ProseMirror JSON document, falling back to
 * stored markdown. Shared by the share page and AI chunking so they see the
 * same text projection. Safe to run on server or client.
 */
export function renderDocText(
  contentJson: unknown,
  contentMd: string | null
): string {
  const fromJson = extractText(contentJson).trim();
  if (fromJson) return fromJson;
  return (contentMd ?? "").trim();
}

function extractText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  let out = "";
  if (n.text) out += n.text;
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      out += extractText(child);
      const t = (child as { type?: string }).type;
      if (t === "paragraph" || t === "heading" || t === "listItem") out += "\n";
    }
  }
  return out;
}
