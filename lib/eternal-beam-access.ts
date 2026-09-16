import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createSignedAccessToken, verifySignedAccessToken, type EternalBeamAccessSource } from "@/lib/eternal-beam-access-token";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const ETERNAL_BEAM_ACCESS_COOKIE = "soul-trace-eternal-beam-access";
export const ETERNAL_BEAM_ACCESS_MAX_AGE = 60 * 60 * 24 * 30;
const ACCESS_SCOPE = "life_archive";

export type EternalBeamAccessIdentity = { ebUserId: string; orderId: string };

function sessionSecret(): string | null {
  return process.env.LIFE_ARCHIVE_ACCESS_SESSION_SECRET?.trim() || null;
}

export function createEternalBeamAccessSession(
  source: EternalBeamAccessSource = "eternal_beam",
  now = Date.now(),
): string {
  const secret = sessionSecret();
  if (!secret) throw new Error("Life Archive access sessions are not configured.");
  return createSignedAccessToken(secret, source, ETERNAL_BEAM_ACCESS_MAX_AGE, now);
}

export async function createPersistentEternalBeamAccessSession(
  identity: EternalBeamAccessIdentity,
  now = Date.now(),
): Promise<string> {
  const client = createSupabaseServerClient();
  if (!client) throw new Error("Life Archive access session storage is not configured.");
  const token = randomBytes(32).toString("base64url");
  const { error } = await client.from("eternal_beam_access_sessions").insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
    eb_user_id: identity.ebUserId,
    order_id: identity.orderId,
    scope: ACCESS_SCOPE,
    verified_at: new Date(now).toISOString(),
    expires_at: new Date(now + ETERNAL_BEAM_ACCESS_MAX_AGE * 1000).toISOString(),
  });
  if (error) throw new Error("Life Archive access session could not be stored.");
  return token;
}

export async function verifyEternalBeamAccessSession(
  value: string | null | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!value) return false;
  // Phase 1's signed simulator remains available only outside production.
  if (process.env.NODE_ENV !== "production" && value.includes(".")) {
    return verifySignedAccessToken(value, sessionSecret() ?? "", now);
  }
  const client = createSupabaseServerClient();
  if (!client) return false;
  const digest = createHash("sha256").update(value).digest("hex");
  const { data, error } = await client.from("eternal_beam_access_sessions")
    .select("session_id")
    .eq("token_hash", digest).eq("scope", ACCESS_SCOPE)
    .is("revoked_at", null).gt("expires_at", new Date(now).toISOString()).maybeSingle();
  return !error && Boolean(data?.session_id);
}

export function eternalBeamAccessCookieOptions(maxAge = ETERNAL_BEAM_ACCESS_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function requestHasEternalBeamAccess(request: { cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  return verifyEternalBeamAccessSession(request.cookies.get(ETERNAL_BEAM_ACCESS_COOKIE)?.value);
}
