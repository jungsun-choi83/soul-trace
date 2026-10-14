import "server-only";

import { timingSafeEqual } from "node:crypto";

import { aiGenerationIdentityHash } from "@/lib/ai-generation-guard";

/**
 * Check the authenticated owner of a Seasonal Polaroid job without exposing
 * the stored identity digest. A missing digest or guard secret fails closed.
 */
export function seasonalPolaroidOwnerMatches(
  ownerIdentityHash: unknown,
  userId: unknown,
): boolean {
  if (
    typeof ownerIdentityHash !== "string"
    || typeof userId !== "string"
    || !userId.trim()
  ) return false;

  const expected = aiGenerationIdentityHash(userId);
  if (!expected || expected.length !== ownerIdentityHash.length) return false;

  try {
    return timingSafeEqual(Buffer.from(ownerIdentityHash, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
