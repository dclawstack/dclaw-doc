"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";

const FORMATS: { fmt: string; label: string }[] = [
  { fmt: "md", label: "Markdown (.md)" },
  { fmt: "html", label: "HTML (.html)" },
  { fmt: "json", label: "JSON (.json)" },
];

export function ExportMenu({ docId }: { docId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {FORMATS.map((f) => (
            <a
              key={f.fmt}
              href={`/api/documents/${docId}/export?fmt=${f.fmt}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            >
              {f.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
