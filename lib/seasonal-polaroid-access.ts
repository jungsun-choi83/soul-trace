import "server-only";

import { timingSafeEqual } from "node:crypto";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

/**
 * The feature flag is the primary activation control. During a controlled
 * test, an operator can additionally enable test mode to require either a
 * server-side tester token or an authenticated tester identity.
 *
 * None of these values are exposed to the browser. The token option is useful
 * for curl/Postman smoke tests; the identity option lets the normal browser
 * session work without putting a secret in client JavaScript.
 */
export const SEASONAL_POLAROID_TEST_TOKEN_HEADER = "x-soul-trace-seasonal-test-token";
const LOCAL_DEVELOPMENT_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * The expensive-limit bypass is available only to a local Next development
 * server with the explicit test flag enabled. NODE_ENV is read on the server;
 * no browser-controlled value can activate this branch.
 */
export function seasonalPolaroidDeveloperTestMode(): boolean {
  return process.env.NODE_ENV === "development"
    && enabled(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE);
}

/** Defense in depth; the dev script also binds Next to loopback. */
export function seasonalPolaroidDeveloperRequestAllowed(request: Request): boolean {
  if (!seasonalPolaroidDeveloperTestMode()) return false;
  try {
    return LOCAL_DEVELOPMENT_HOSTNAMES.has(new URL(request.url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function configuredList(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function tokenMatches(request: Request): boolean {
  const expected = process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_TOKEN?.trim() ?? "";
  const received = request.headers.get(SEASONAL_POLAROID_TEST_TOKEN_HEADER)?.trim() ?? "";
  if (!expected || !received || expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * When controlled test mode is off, the feature flag deliberately permits the
 * normal anonymous user journey. When test mode is on, this fails closed if
 * an allowlist/token or the auth configuration is missing.
 */
export async function seasonalPolaroidAccessAllowed(request: Request): Promise<boolean> {
  if (!enabled(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE)) return true;
  if (seasonalPolaroidDeveloperRequestAllowed(request)) return true;
  if (tokenMatches(request)) return true;

  const userIds = configuredList("SOUL_TRACE_SEASONAL_POLAROID_TEST_USER_IDS");
  const emails = configuredList("SOUL_TRACE_SEASONAL_POLAROID_TEST_EMAILS");
  if (!userIds.size && !emails.size) return false;

  try {
    const auth = await createSupabaseAuthServerClient();
    const user = auth ? (await auth.auth.getUser()).data.user : null;
    if (!user) return false;
    return userIds.has(user.id.toLowerCase()) || (user.email ? emails.has(user.email.toLowerCase()) : false);
  } catch {
    return false;
  }
}

export function seasonalPolaroidTestModeConfigured(): boolean {
  return enabled(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE)
    && (Boolean(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_TOKEN?.trim())
      || Boolean(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_USER_IDS?.trim())
      || Boolean(process.env.SOUL_TRACE_SEASONAL_POLAROID_TEST_EMAILS?.trim()));
}
