import type { ServerSearchParams } from "./search-params.ts";
import { normalizeAuthLocale } from "./passwordless-auth.ts";

const INTERNAL_ORIGIN = "https://soul-trace.invalid";

export function safeInternalPath(value: string | null | undefined, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate?.startsWith("/") || candidate.startsWith("//")) return fallback;

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function isAuthLoopPath(pathname: string): boolean {
  return pathname === "/auth" || pathname.startsWith("/auth/");
}

export function safeAuthReturnPath(
  value: string | null | undefined,
  fallback = "/choose",
): string {
  const destination = safeInternalPath(value, fallback);
  const parsed = new URL(destination, INTERNAL_ORIGIN);
  return isAuthLoopPath(parsed.pathname) ? fallback : destination;
}

export function authEntryPath(returnTo: string): string {
  const params = new URLSearchParams({ returnTo: safeAuthReturnPath(returnTo) });
  return `/auth?${params.toString()}`;
}

export function safeAuthErrorPath(
  value: string | null | undefined,
  fallback: string,
): string {
  const destination = safeInternalPath(value, fallback);
  const pathname = new URL(destination, INTERNAL_ORIGIN).pathname;
  return pathname === "/auth/confirm" || pathname.startsWith("/auth/confirm/")
    ? fallback
    : destination;
}

export function safeRecoveryDestination(value: string | null | undefined): string | null {
  const candidate = safeInternalPath(value, "");
  if (!candidate) return null;
  const parsed = new URL(candidate, INTERNAL_ORIGIN);
  if (parsed.pathname !== "/auth/update-password") return null;
  const returnTo = safeAuthReturnPath(parsed.searchParams.get("returnTo"));
  const params = new URLSearchParams({ returnTo });
  return `/auth/update-password?${params.toString()}`;
}

export function safeAuthConfirmationPath(value: string | null | undefined, fallback: string): string {
  return safeRecoveryDestination(value) ?? safeAuthReturnPath(value, fallback);
}

export function authenticatedAuthDestination(
  hasVerifiedIdentity: boolean,
  returnTo: string,
): string | null {
  return hasVerifiedIdentity ? safeAuthReturnPath(returnTo) : null;
}

export function resolveAuthReturnPath(params: ServerSearchParams): string {
  const rawReturnTo = params.returnTo;
  const candidate = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const destination = new URL(safeAuthReturnPath(candidate), INTERNAL_ORIGIN);

  for (const [key, value] of Object.entries(params)) {
    if (key === "returnTo" || key === "authError" || key === "passwordUpdated") continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) destination.searchParams.append(key, item);
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function authCallbackUrl(origin: string, returnTo: string, locale: unknown): string {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  const callback = new URL("/auth/confirm", origin);
  callback.searchParams.set("next", safeReturnTo);
  callback.searchParams.set("locale", normalizeAuthLocale(locale));

  const errorReturn = new URL("/auth", origin);
  errorReturn.searchParams.set("returnTo", safeReturnTo);
  callback.searchParams.set(
    "errorTo",
    `${errorReturn.pathname}${errorReturn.search}`,
  );
  return callback.toString();
}

export function passwordRecoveryCallbackUrl(origin: string, returnTo: string, locale: unknown): string {
  const safeReturnTo = safeAuthReturnPath(returnTo);
  const recovery = new URL("/auth/update-password", origin);
  recovery.searchParams.set("returnTo", safeReturnTo);
  const callback = new URL("/auth/confirm", origin);
  callback.searchParams.set("next", `${recovery.pathname}${recovery.search}`);
  const errorReturn = new URL("/auth", origin);
  errorReturn.searchParams.set("returnTo", safeReturnTo);
  callback.searchParams.set("errorTo", `${errorReturn.pathname}${errorReturn.search}`);
  callback.searchParams.set("locale", normalizeAuthLocale(locale));
  return callback.toString();
}
