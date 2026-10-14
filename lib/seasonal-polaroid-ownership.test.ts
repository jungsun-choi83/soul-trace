import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ownership = readFileSync("lib/seasonal-polaroid-ownership.ts", "utf8");
const status = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
const image = readFileSync("app/api/seasonal-polaroid/image/route.ts", "utf8");
const save = readFileSync("app/api/account-result/seasonal-polaroid/route.ts", "utf8");

test("Seasonal ownership uses the server-side identity hash and constant-time comparison", () => {
  assert.match(ownership, /aiGenerationIdentityHash\(userId\)/);
  assert.match(ownership, /timingSafeEqual/);
  assert.match(ownership, /!expected/);
  assert.match(ownership, /return false/);
});

test("Seasonal status, image, and save routes reject wrong or missing owners", () => {
  assert.match(status, /seasonalPolaroidOwnerMatches\(job\.owner_identity_hash, seasonalUserId\)/);
  assert.match(image, /seasonalPolaroidOwnerMatches\(job\.owner_identity_hash, seasonalUserId\)/);
  assert.match(save, /seasonalPolaroidOwnerMatches\(job\?\.owner_identity_hash, user\.id\)/);
  assert.match(status, /if \(!user\) return seasonalPrivateResponse/);
  assert.match(image, /if \(!user\) return notFound/);
  assert.match(save, /authentication_required/);
});
