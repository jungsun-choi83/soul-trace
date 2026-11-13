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

/** A verified new account should create its first pet, retaining the selected branch. */
export function newAccountProfilePath(returnTo: string): string {
  const destination = safeAuthReturnPath(returnTo);
  const parsed = new URL(destination, INTERNAL_ORIGIN);
  // Free Trial saving resumes its own guest result after signup; it does not
  // create a normal Pet Roster profile as part of account confirmation.
  if (["/try/save", "/my/free-trial-results"].includes(parsed.pathname)) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (parsed.pathname === "/memories" && parsed.searchParams.get("pet")) {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (parsed.pathname === "/my/pets/new") {
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }
  if (["/living", "/memorial", "/polaroid"].includes(parsed.pathname)) {
    const params = new URLSearchParams();
    const requestedStatus = parsed.searchParams.get("status") ?? parsed.searchParams.get("branch");
    const status = parsed.pathname === "/living"
      ? "living"
      : parsed.pathname === "/memorial"
        ? "memorial"
        : requestedStatus === "living" || requestedStatus === "memorial" ? requestedStatus : null;
    if (status) params.set("status", status);
    params.set("continueTo", destination);
    return `/my/pets/new?${params.toString()}`;
  }
  if (parsed.pathname === "/dashboard/living") return "/my/pets/new?status=living";
  if (parsed.pathname === "/dashboard/memorial") return "/my/pets/new?status=memorial";
  return "/my/pets/new";
}

/** Resume a newly registered user's selected create flow using their new canonical Pet ID. */
export function petCreationContinuePath(returnTo: string | null | undefined, petId: string): string | null {
  const destination = safeAuthReturnPath(returnTo, "/dashboard");
  const parsed = new URL(destination, INTERNAL_ORIGIN);
  if (!["/living", "/memorial", "/polaroid"].includes(parsed.pathname)) return null;
  parsed.searchParams.delete("pet");
  parsed.searchParams.delete("petId");
  parsed.searchParams.set("petId", petId);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
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
