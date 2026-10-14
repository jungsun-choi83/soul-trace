import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
const status = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
const image = readFileSync("app/api/seasonal-polaroid/image/route.ts", "utf8");
const feature = readFileSync("lib/seasonal-polaroid-feature.ts", "utf8");

test("Seasonal admission validates, hashes, guards, attaches, and returns a capability", () => {
  assert.match(route, /validateSeasonalPolaroidRequest/);
  assert.match(route, /validateSeasonalPolaroidPhotoContent/);
  assert.match(route, /seasonalPolaroidRequestHash/);
  assert.match(route, /admitSeasonalPolaroidInternally/);
  assert.match(route, /issueSeasonalPolaroidCapability/);
  assert.match(route, /jobId/);
  assert.match(route, /capability/);
});

test("activation defaults off and does not touch production configuration", () => {
  assert.match(feature, /=== "true"/);
  assert.match(route, /SEASONAL_POLAROID_GENERATION_ENABLED = isSeasonalPolaroidEnabled\(\)/);
  assert.match(route, /seasonal_polaroid_unavailable/);
  assert.match(status, /kind === "seasonal_polaroid" && !SEASONAL_STATUS_ENABLED/);
  assert.match(image, /if \(!isSeasonalPolaroidEnabled\(\)\)/);
});

test("Seasonal generation and private result access require a server session outside localhost developer mode", () => {
  assert.match(route, /createSupabaseAuthServerClient/);
  assert.match(route, /authentication_required/);
  assert.match(route, /auth\.auth\.getUser\(\)/);
  assert.match(status, /createSupabaseAuthServerClient/);
  assert.match(image, /createSupabaseAuthServerClient/);
});

test("status and image delivery require separate capabilities and never expose object keys", () => {
  assert.match(status, /seasonalPolaroidCapabilityMatches/);
  assert.match(status, /issueSeasonalPolaroidImageAccessToken/);
  assert.match(status, /kind: "private-proxy"/);
  assert.doesNotMatch(status, /objectKey/);
  assert.match(image, /x-soul-trace-seasonal-capability/);
  assert.match(image, /x-soul-trace-seasonal-image-token/);
  assert.match(image, /seasonalPolaroidImageAccessTokenMatches/);
  assert.match(image, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(image, /getPublicUrl/);
});
