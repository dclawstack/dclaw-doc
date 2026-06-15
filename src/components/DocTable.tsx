import Link from "next/link";
import { FileText } from "lucide-react";
import { StatusBadge, type DocStatus } from "@/components/StatusBadge";
import {
  SensitivityBadge,
  type Sensitivity,
} from "@/components/SensitivityBadge";
import { formatDate } from "@/lib/format";

export type DocRow = {
  id: string;
  title: string;
  status: DocStatus;
  sensitivity: Sensitivity;
  version: number;
  updatedAt: string;
};

export function DocTable({
  items,
  emptyMessage = "No documents yet. Create your first one.",
}: {
  items: DocRow[];
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-4 py-2.5 font-medium">Title</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Sensitivity</th>
            <th className="px-4 py-2.5 font-medium">Version</th>
            <th className="px-4 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {items.map((doc) => (
            <tr key={doc.id} className="group hover:bg-zinc-50">
              <td className="px-4 py-3">
                <Link
                  href={`/docs/${doc.id}`}
                  className="flex items-center gap-2 font-medium text-zinc-900 group-hover:text-indigo-600"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{doc.title}</span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-4 py-3">
                <SensitivityBadge sensitivity={doc.sensitivity} />
              </td>
              <td className="px-4 py-3 text-zinc-500">v{doc.version}</td>
              <td className="px-4 py-3 text-zinc-500">
                {formatDate(doc.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
