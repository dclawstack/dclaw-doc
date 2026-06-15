import "server-only";
import { randomBytes } from "crypto";

/** Opaque, URL-safe token for public share links. */
export function shareToken(): string {
  return randomBytes(18).toString("base64url");
}

export const DOC_ROLES = ["viewer", "commenter", "editor", "owner"] as const;
export type DocRoleValue = (typeof DOC_ROLES)[number];

export const SENSITIVITIES = [
  "public",
  "confidential",
  "pii",
  "phi",
] as const;
export type SensitivityValue = (typeof SENSITIVITIES)[number];
