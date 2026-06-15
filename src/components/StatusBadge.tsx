import { cn } from "@/lib/utils";

export type DocStatus = "draft" | "review" | "approved";

const styles: Record<DocStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  review: "bg-amber-50 text-amber-700 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset capitalize",
        styles[status] ?? styles.draft
      )}
    >
      {status}
    </span>
  );
}
