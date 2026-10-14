import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { aiGenerationIdentityHash } from "@/lib/ai-generation-guard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const SEASONAL_POLAROID_GUEST_COOKIE = "soul-trace-seasonal-guest";
export const SEASONAL_POLAROID_GUEST_TRIAL_LIMIT = 2;
// The historical table/RPC names are retained for additive migration
// compatibility. Normal production callers now pass this account-derived
// digest instead of a browser-cookie digest.
export const SEASONAL_POLAROID_ACCOUNT_TRIAL_LIMIT = SEASONAL_POLAROID_GUEST_TRIAL_LIMIT;
// This exceeds the 270-second queue lease and the worker's bounded execution
// window. The queue has no hard upper bound on backlog, so production rollout
// must also monitor queue age; expiry is the finite abandoned-job safeguard.
export const SEASONAL_POLAROID_GUEST_RESERVATION_SECONDS = 60 * 60;

export type SeasonalGuestTrialDecision =
  | { decision: "reserved" | "already_reserved"; reservationId: string; reservationVersion: number; remaining: number; owner: boolean }
  | { decision: "already_succeeded"; reservationId: string; reservationVersion: number; remaining: number; owner: false }
  | { decision: "exhausted"; remaining: 0 }
  | { decision: "unavailable" };

export type SeasonalGuestTrialState = {
  remaining: number;
  successful: number;
  reserved: number;
};

function trialSecret(): string | null {
  return process.env.AI_GENERATION_GUARD_SECRET?.trim()
    || process.env.SOUL_TRACE_SERVICE_TOKEN?.trim()
    || null;
}

function signGuestId(id: string): string | null {
  const secret = trialSecret();
  return secret
    ? createHmac("sha256", secret).update(`seasonal-guest:${id}`).digest("base64url")
    : null;
}

function guestHash(id: string): string | null {
  const secret = trialSecret();
  return secret
    ? createHmac("sha256", secret).update(`seasonal-guest-hash:${id}`).digest("hex")
    : null;
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SEASONAL_POLAROID_GUEST_COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

function validGuestValue(value: string): { id: string; hash: string } | null {
  const [id, signature] = value.split(".");
  if (!id || !signature || !/^[A-Za-z0-9_-]{32,128}$/.test(id) || !/^[A-Za-z0-9_-]{32,128}$/.test(signature)) return null;
  const expected = signGuestId(id);
  const hash = guestHash(id);
  if (!expected || !hash || expected.length !== signature.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  return { id, hash };
}

export type SeasonalGuestIdentity = {
  hash: string;
  setCookie: string | null;
};

/**
 * Stable account identity for the Seasonal allowance. This deliberately
 * uses the same HMAC derivation as queue ownership (owner_identity_hash), so
 * changing browsers or clearing cookies cannot create another allowance.
 */
export function seasonalPolaroidAccountIdentityHash(userId: string): string | null {
  return aiGenerationIdentityHash(userId);
}

/**
 * Returns a signed, opaque browser identity. The raw id is never sent to the
 * database; only a keyed digest is used by the trial RPCs.
 * @deprecated Normal Seasonal admission is account-scoped and must use
 * seasonalPolaroidAccountIdentityHash. Kept for reviewed legacy callers only.
 */
export function seasonalGuestIdentity(request: Request): SeasonalGuestIdentity | null {
  if (!trialSecret()) return null;
  const current = readCookie(request);
  const parsed = current ? validGuestValue(current) : null;
  if (parsed) return { hash: parsed.hash, setCookie: null };

  const id = randomBytes(32).toString("base64url");
  const signature = signGuestId(id);
  const hash = guestHash(id);
  if (!signature || !hash) return null;
  const secure = process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:";
  const setCookie = [
    `${SEASONAL_POLAROID_GUEST_COOKIE}=${id}.${signature}`,
    "Path=/",
    "Max-Age=31536000",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
  return { hash, setCookie };
}

function rpcObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function trialResult(data: unknown): SeasonalGuestTrialDecision {
  const value = rpcObject(data);
  const decision = value?.decision;
  const reservationId = typeof value?.reservation_id === "string" ? value.reservation_id : "";
  const reservationVersion = typeof value?.reservation_version === "number" ? Math.floor(value.reservation_version) : 0;
  const remaining = typeof value?.remaining === "number" ? Math.max(0, Math.min(SEASONAL_POLAROID_GUEST_TRIAL_LIMIT, Math.floor(value.remaining))) : 0;
  if ((decision === "reserved" || decision === "already_reserved") && reservationId && reservationVersion > 0) {
    return { decision, reservationId, reservationVersion, remaining, owner: decision === "reserved" };
  }
  if (decision === "already_succeeded" && reservationId && reservationVersion > 0) return { decision, reservationId, reservationVersion, remaining, owner: false };
  if (decision === "exhausted") return { decision: "exhausted", remaining: 0 };
  return { decision: "unavailable" };
}

export async function readSeasonalGuestTrial(guestHashValue: string): Promise<SeasonalGuestTrialState | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase || !/^[a-f0-9]{64}$/.test(guestHashValue)) return null;
  const { data, error } = await supabase.rpc("reconcile_seasonal_polaroid_guest_trial", {
    p_guest_hash: guestHashValue,
    p_now: new Date().toISOString(),
  });
  if (error) {
    console.error("[seasonal-guest-trial] state read failed", { code: error.code });
    return null;
  }
  const value = rpcObject(data);
  if (!value) return null;
  const successful = typeof value.successful === "number" ? Math.max(0, Math.min(2, Math.floor(value.successful))) : 0;
  const reserved = typeof value.reserved === "number" ? Math.max(0, Math.min(2, Math.floor(value.reserved))) : 0;
  return { successful, reserved, remaining: Math.max(0, 2 - successful - reserved) };
}

/** Account-named alias for the legacy guest-trial RPC adapter. */
export async function readSeasonalAccountTrial(accountHash: string): Promise<SeasonalGuestTrialState | null> {
  return readSeasonalGuestTrial(accountHash);
}

export async function reserveSeasonalGuestTrial(args: {
  /** Account HMAC used by normal authenticated requests. */
  accountHash?: string;
  /** @deprecated Cookie identity is retained only for legacy callers/tests. */
  guestHash?: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<SeasonalGuestTrialDecision> {
  const supabase = createSupabaseServerClient();
  const identityHash = args.accountHash ?? args.guestHash;
  if (!supabase || !identityHash) return { decision: "unavailable" };
  const { data, error } = await supabase.rpc("reserve_seasonal_polaroid_guest_trial", {
    // The pending migration keeps this parameter name for compatibility;
    // its value is now the authenticated account HMAC for production calls.
    p_guest_hash: identityHash,
    p_idempotency_key: args.idempotencyKey,
    p_request_hash: args.requestHash,
    p_expires_at: new Date(Date.now() + SEASONAL_POLAROID_GUEST_RESERVATION_SECONDS * 1000).toISOString(),
  });
  if (error) {
    console.error("[seasonal-guest-trial] reservation failed", { code: error.code });
    return { decision: "unavailable" };
  }
  return trialResult(data);
}

/** Account-named adapter used by Seasonal admission. */
export async function reserveSeasonalAccountTrial(args: {
  accountHash: string;
  idempotencyKey: string;
  requestHash: string;
}): Promise<SeasonalGuestTrialDecision> {
  return reserveSeasonalGuestTrial(args);
}

export async function bindSeasonalGuestTrial(args: {
  reservationId: string;
  reservationVersion: number;
  jobId: string;
  requestHash: string;
}): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("bind_seasonal_polaroid_guest_trial", {
    p_reservation_id: args.reservationId,
    p_reservation_version: args.reservationVersion,
    p_job_id: args.jobId,
    p_request_hash: args.requestHash,
  });
  if (error) console.error("[seasonal-guest-trial] reservation bind failed", { code: error.code });
  return data === true;
}

export async function finalizeSeasonalGuestTrial(reservationId: string, reservationVersion: number): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("finalize_seasonal_polaroid_guest_trial", {
    p_reservation_id: reservationId,
    p_reservation_version: reservationVersion,
  });
  if (error) console.error("[seasonal-guest-trial] finalization failed", { code: error.code });
  return data === true;
}

export async function releaseSeasonalGuestTrial(reservationId: string, reservationVersion: number): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("release_seasonal_polaroid_guest_trial", {
    p_reservation_id: reservationId,
    p_reservation_version: reservationVersion,
  });
  if (error) console.error("[seasonal-guest-trial] reservation release failed", { code: error.code });
  return data === true;
}
