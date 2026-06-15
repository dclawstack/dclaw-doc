import { cn } from "@/lib/utils";

export type Sensitivity = "public" | "confidential" | "pii" | "phi";

const styles: Record<Sensitivity, string> = {
  public: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  confidential: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  pii: "bg-orange-50 text-orange-700 ring-orange-200",
  phi: "bg-rose-50 text-rose-700 ring-rose-200",
};

const labels: Record<Sensitivity, string> = {
  public: "Public",
  confidential: "Confidential",
  pii: "PII",
  phi: "PHI",
};

export function SensitivityBadge({ sensitivity }: { sensitivity: Sensitivity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        styles[sensitivity] ?? styles.public
      )}
    >
      {labels[sensitivity] ?? sensitivity}
    </span>
  );
}
