"use client";

import { EditorContent, useEditor, type Content } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function Editor({
  initialContent,
  onChange,
}: {
  initialContent: unknown;
  onChange: (contentJson: unknown, text: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: (initialContent as Content) ?? "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "editor min-h-[60vh] focus:outline-none",
        "aria-label": "Document body",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getText());
    },
  });

  return <EditorContent editor={editor} />;
}
