import { isPetFirstArchiveEnabled } from "./pet-first-archive.ts";
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

export function authEntryPath(returnTo: string, mode?: "signin" | "signup"): string {
  const params = new URLSearchParams({ returnTo: safeAuthReturnPath(returnTo) });
  if (mode) params.set("mode", mode);
  return `/auth?${params.toString()}`;
}

export function continueAfterAuth(returnTo: string): string {
  const destination = safeAuthReturnPath(returnTo);
  if (!isPetFirstArchiveEnabled()) return destination;
  const path = new URL(destination, INTERNAL_ORIGIN).pathname;
  if (path === "/" || path === "/choose") return "/dashboard";
  return destination;
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
  return hasVerifiedIdentity ? continueAfterAuth(returnTo) : null;
}

export function resolveAuthReturnPath(params: ServerSearchParams): string {
  const rawReturnTo = params.returnTo;
  const candidate = Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo;
  const destination = new URL(safeAuthReturnPath(candidate), INTERNAL_ORIGIN);

  for (const [key, value] of Object.entries(params)) {
    if (key === "returnTo" || key === "authError" || key === "passwordUpdated" || key === "mode") continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) destination.searchParams.append(key, item);
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

export function authCallbackUrl(origin: string, returnTo: string, locale: unknown): string {
  const safeReturnTo = continueAfterAuth(returnTo);
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

function isLocalOnlyHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "0.0.0.0" || host === "::1" || host.endsWith(".local")) return true;
  if (host.startsWith("127.")) return true;
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = numbers;
  return first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
}

export function authEmailOrigin(browserOrigin: string, publicOrigin: string): string {
  let browser: URL;
  try {
    browser = new URL(browserOrigin);
  } catch {
    return new URL(publicOrigin).origin;
  }
  if (!isLocalOnlyHostname(browser.hostname)) return browser.origin;
  try {
    const published = new URL(publicOrigin);
    if (published.protocol === "https:" || published.protocol === "http:") return published.origin;
  } catch {
    return browser.origin;
  }
  return browser.origin;
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
