"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

interface Props {
  documentId: string;
  workspaceId: string;
  authorId?: string;
  /** Markdown to seed the Yjs doc with if it's empty. */
  initialMarkdown: string;
  /** Called with the latest markdown projection after every change. */
  onChange: (markdown: string) => void;
  ariaLabel?: string;
}

let htmlToMd: ((html: string) => string) | null = null;
let mdToHtml: ((markdown: string) => string) | null = null;

async function loadConverters() {
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

function pickWsBase(): string {
  const httpBase = process.env.NEXT_PUBLIC_API_URL || "";
  if (httpBase.startsWith("https://")) return "wss://" + httpBase.slice(8);
  if (httpBase.startsWith("http://")) return "ws://" + httpBase.slice(7);
  // Fall back to the page origin
  if (typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://${window.location.host}`;
  }
  return "ws://localhost:8107";
}

/**
 * Collaborative rich-text editor.
 *
 * Speaks the y-websocket wire protocol to ``/api/v1/documents/{id}/sync``
 * on the backend. The Yjs document is the source of truth while the
 * editor is connected; we also project to markdown and call ``onChange``
 * so the caller can persist a snapshot through the existing PATCH path
 * for non-collab readers.
 */
export function CollabRichEditor({
  documentId,
  workspaceId,
  authorId,
  initialMarkdown,
  onChange,
  ariaLabel,
}: Props) {
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [synced, setSynced] = useState(false);
  const [peers, setPeers] = useState(1);
  const lastEmitted = useRef<string>(initialMarkdown);

  // Wire the WebSocket provider once we have an id.
  useEffect(() => {
    const wsBase = pickWsBase();
    const wsProvider = new WebsocketProvider(
      `${wsBase}/api/v1/documents`,
      `${documentId}/sync`,
      ydoc,
      {
        params: {
          workspace_id: workspaceId,
          ...(authorId ? { author_id: authorId } : {}),
        },
      },
    );
    wsProvider.on("sync", (isSynced: boolean) => setSynced(isSynced));
    wsProvider.awareness.on("change", () => {
      setPeers(wsProvider.awareness.getStates().size);
    });
    setProvider(wsProvider);
    return () => {
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [documentId, workspaceId, authorId, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        // Collaboration replaces StarterKit's history; the Yjs doc owns undo.
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        ...(provider
          ? [
              CollaborationCursor.configure({
                provider,
                user: { name: authorId ?? "anonymous", color: "#6366F1" },
              }),
            ]
          : []),
      ],
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none min-h-[300px] rounded-md border border-input bg-background p-4 focus:outline-none",
          "aria-label": ariaLabel ?? "Collaborative document editor",
        },
      },
    },
    [provider],
  );

  // Seed the Yjs doc with the initial markdown the first time we sync.
  // If the doc already has content (because other clients populated it),
  // skip — Collaboration takes care of hydration.
  useEffect(() => {
    if (!editor || !synced) return;
    const xml = ydoc.getXmlFragment("default");
    if (xml.length > 0) return;
    let cancelled = false;
    (async () => {
      const { mdToHtml: m2h } = await loadConverters();
      if (cancelled) return;
      editor.commands.setContent(m2h(initialMarkdown || ""), false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, synced, ydoc, initialMarkdown]);

  // Project Yjs → markdown after every update so a non-collab client can
  // refresh and still see the latest content via the existing GET path.
  useEffect(() => {
    if (!editor) return;
    let frame = 0;
    const handler = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(async () => {
        const { htmlToMd: h2m } = await loadConverters();
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            synced ? "bg-green-500" : "bg-amber-500"
          }`}
        />
        <span>{synced ? `Live · ${peers} connected` : "Connecting…"}</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
