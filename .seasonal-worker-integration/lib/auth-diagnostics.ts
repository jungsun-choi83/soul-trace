export type AuthDiagnosticStage =
  | "browser-client"
  | "signup"
  | "signin"
  | "callback-code-exchange"
  | "callback-otp-verification"
  | "callback-legacy-claim";

type AuthErrorDetails = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

function safeText(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .replace(/([?&](?:code|token|token_hash|access_token|refresh_token)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 500);
}

export function logAuthFailure(stage: AuthDiagnosticStage, error: unknown): void {
  const details = error && typeof error === "object" ? error as AuthErrorDetails : {};
  const status = typeof details.status === "number" ? details.status : undefined;
  const code = safeText(details.code);
  const name = safeText(details.name) ?? (error instanceof Error ? error.name : undefined);
  const message = safeText(details.message) ?? (error instanceof Error ? safeText(error.message) : undefined);

  console.error("[auth] Supabase authentication failed", {
    stage,
    status,
    code,
    name,
    message,
  });
}
