"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

interface Props {
  /** Initial markdown to render — converted to HTML on first mount. */
  initialMarkdown: string;
  /** Called with the latest markdown projection after every change. */
  onChange: (markdown: string) => void;
  /** Optional aria label for accessibility. */
  ariaLabel?: string;
}

let htmlToMd: ((html: string) => string) | null = null;
let mdToHtml: ((markdown: string) => string) | null = null;

async function ensureConverters() {
  if (htmlToMd && mdToHtml) return { htmlToMd, mdToHtml };
  const [{ default: TurndownService }, { marked }] = await Promise.all([
    import("turndown"),
    import("marked"),
  ]);
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  htmlToMd = (html: string) => turndown.turndown(html);
  mdToHtml = (md: string) => marked.parse(md, { async: false }) as string;
  return { htmlToMd, mdToHtml };
}

/**
 * TipTap-based block editor that round-trips through Markdown so the
 * backend ``content_md`` column stays the source of truth.
 *
 * StarterKit covers headings, lists, bold/italic, code, blockquotes,
 * paragraphs — enough to feel like Notion without bringing in the full
 * shadcn UI surface.
 */
export function RichEditor({ initialMarkdown, onChange, ariaLabel }: Props) {
  const lastEmitted = useRef<string>(initialMarkdown);

  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[300px] rounded-md border border-input bg-background p-4 focus:outline-none",
        "aria-label": ariaLabel ?? "Document editor",
      },
    },
  });

  // Seed once with converted HTML when the converters resolve.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { mdToHtml: m2h } = await ensureConverters();
      if (cancelled || !editor) return;
      editor.commands.setContent(m2h(initialMarkdown || ""), false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Emit markdown after every update (debounced naively via rAF).
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const handler = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(async () => {
        const { htmlToMd: h2m } = await ensureConverters();
        const md = h2m(editor.getHTML()).trim();
        if (md !== lastEmitted.current) {
          lastEmitted.current = md;
          onChange(md);
        }
      });
    };
    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      cancelAnimationFrame(frame);
    };
  }, [editor, onChange]);

  return <EditorContent editor={editor} />;
}
