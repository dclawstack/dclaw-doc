import "server-only";
import { createHash } from "crypto";

/**
 * Canonical content hash for notarization. Hashes a stable projection of the
 * document so the same logical content always yields the same digest,
 * independent of key ordering in the stored JSON.
 */
export function contentHash(input: {
  title: string;
  contentMd: string | null;
  contentJson: unknown;
  version: number;
}): string {
  const canonical = JSON.stringify({
    title: input.title,
    version: input.version,
    contentMd: input.contentMd ?? "",
    contentJson: stableStringify(input.contentJson),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
