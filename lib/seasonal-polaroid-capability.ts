import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  return process.env.AI_GENERATION_GUARD_SECRET?.trim()
    || process.env.SOUL_TRACE_SERVICE_TOKEN?.trim()
    || null;
}

export const SEASONAL_POLAROID_IMAGE_TOKEN_TTL_SECONDS = 300;

export function seasonalPolaroidCapabilityConfigured(): boolean {
  return Boolean(secret());
}

function input(jobId: string, requestHash: string): string {
  return `seasonal-polaroid:${jobId.toLowerCase()}:${requestHash.toLowerCase()}`;
}

/** Deterministic, job-scoped capability: safe to restore after same-browser reload. */
export function issueSeasonalPolaroidCapability(jobId: string, requestHash: string): string | null {
  const key = secret();
  if (!key || !/^[a-f0-9]{64}$/i.test(jobId) || !/^[a-f0-9]{64}$/i.test(requestHash)) return null;
  return createHmac("sha256", key).update(input(jobId, requestHash)).digest("base64url");
}

export function seasonalPolaroidCapabilityMatches(
  token: string,
  jobId: string,
  requestHash: string,
): boolean {
  const expected = issueSeasonalPolaroidCapability(jobId, requestHash);
  if (!expected || !token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

function imageTokenInput(jobId: string, requestHash: string, expiresAt: number): string {
  return `seasonal-polaroid-image:${jobId.toLowerCase()}:${requestHash.toLowerCase()}:${expiresAt}`;
}

/** A short-lived delivery token is returned only alongside an authorized status response. */
export function issueSeasonalPolaroidImageAccessToken(
  jobId: string,
  requestHash: string,
  now = Date.now(),
): string | null {
  const key = secret();
  if (!key || !/^[a-f0-9]{64}$/i.test(jobId) || !/^[a-f0-9]{64}$/i.test(requestHash)) return null;
  const expiresAt = Math.floor(now / 1000) + SEASONAL_POLAROID_IMAGE_TOKEN_TTL_SECONDS;
  const signature = createHmac("sha256", key).update(imageTokenInput(jobId, requestHash, expiresAt)).digest("base64url");
  return `${expiresAt}.${signature}`;
}

export function seasonalPolaroidImageAccessTokenMatches(
  token: string,
  jobId: string,
  requestHash: string,
  now = Date.now(),
): boolean {
  const key = secret();
  if (!key || !token || !/^[a-f0-9]{64}$/i.test(jobId) || !/^[a-f0-9]{64}$/i.test(requestHash)) return false;
  const [expiresAtText, signature] = token.split(".");
  const expiresAt = Number(expiresAtText);
  if (!signature || !Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(now / 1000)) return false;
  const expected = createHmac("sha256", key).update(imageTokenInput(jobId, requestHash, expiresAt)).digest("base64url");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
