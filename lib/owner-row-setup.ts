export type OwnerSetupError = {
  code?: unknown;
  message?: unknown;
  hint?: unknown;
};

export type OwnerSetupAttempt =
  | { ok: true }
  | { ok: false; error: OwnerSetupError }
  | { ok: false; unavailable: true; reason: "service_client_unavailable" | "owner_id_unavailable" };

export type OwnerSetupResult =
  | { ok: true; source: "rpc" | "fallback"; rpcError?: OwnerSetupError }
  | {
      ok: false;
      rpcError: OwnerSetupError;
      fallbackError: OwnerSetupError | null;
      fallbackUnavailableReason?: "service_client_unavailable" | "owner_id_unavailable";
    };

export function logOwnerSetupDiagnostic(
  terminal: boolean,
  details: Record<string, unknown>,
  logger: Pick<Console, "warn" | "error"> = console,
) {
  const log = terminal ? logger.error : logger.warn;
  log.call(
    logger,
    terminal ? "[pet-first] owner setup failed" : "[pet-first] owner setup RPC failed; fallback succeeded",
    details,
  );
}

async function attempt(action: () => Promise<OwnerSetupAttempt>): Promise<OwnerSetupAttempt> {
  try {
    return await action();
  } catch (error) {
    return { ok: false, error: error instanceof Error ? { message: error.message } : {} };
  }
}

export async function runOwnerSetup(
  rpc: () => Promise<OwnerSetupAttempt>,
  fallback: () => Promise<OwnerSetupAttempt>,
): Promise<OwnerSetupResult> {
  const rpcResult = await attempt(rpc);
  if (rpcResult.ok) return { ok: true, source: "rpc" };

  const rpcError = "error" in rpcResult ? rpcResult.error : {};
  const fallbackResult = await attempt(fallback);
  if (fallbackResult.ok) return { ok: true, source: "fallback", rpcError };

  const fallbackError = "error" in fallbackResult ? fallbackResult.error : null;
  const fallbackUnavailableReason = "reason" in fallbackResult ? fallbackResult.reason : undefined;
  return {
    ok: false,
    rpcError,
    fallbackError,
    ...(fallbackUnavailableReason ? { fallbackUnavailableReason } : {}),
  };
}

export function sanitizeOwnerSetupDiagnostic(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const sanitized = value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[redacted-token]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[redacted-url]")
    .replace(/\b((?:password|passwd|secret|token|api[_ -]?key|service[_ -]?role[_ -]?key))\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b[A-F0-9]{32,}\b/gi, "[redacted-value]")
    .replace(/\b[A-Za-z0-9_-]{48,}\b/g, "[redacted-value]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return sanitized ? sanitized.slice(0, maxLength) : undefined;
}

export function sanitizeOwnerSetupCode(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(value)) return undefined;
  return value;
}
