import { normalizeAuthEmail } from "./passwordless-auth.ts";

export function maskEmail(email: string): string {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return "";
  const at = normalized.indexOf("@");
  return `${normalized.slice(0, 1)}***@${normalized.slice(at + 1)}`;
}

export function resolvePendingContactEmail(serverEmail: string | null, submittedEmail: string): string {
  return normalizeAuthEmail(serverEmail ?? "") ?? normalizeAuthEmail(submittedEmail) ?? "";
}
