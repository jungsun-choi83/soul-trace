import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/my-polaroids/route.ts", "utf8");
const exporter = readFileSync("lib/seasonal-polaroid-export.ts", "utf8");
const page = readFileSync("components/my-polaroids-page.tsx", "utf8");
const frame = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");
const client = readFileSync("lib/my-polaroids-client.ts", "utf8");
const choose = readFileSync("components/mode-choice.tsx", "utf8");
const result = readFileSync("components/polaroid-entry.tsx", "utf8");
const migration = readFileSync("supabase/migration_seasonal_polaroid_results.sql", "utf8");

test("My Polaroids list is authenticated and filtered by the verified Supabase user", () => {
  assert.match(route, /createSupabaseAuthServerClient/);
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /authentication_required/);
  assert.match(route, /\.eq\("owner_user_id", user\.id\)/);
  assert.match(route, /seasonal_polaroid_results/);
  assert.doesNotMatch(route, /image_object_key/);
  assert.doesNotMatch(route, /owner_user_id: user\.id/);
});

test("gallery images reuse the authenticated private result endpoint", () => {
  assert.match(client, /account-result\/seasonal-polaroid\?resultId=/);
  assert.match(page, /fetchMyPolaroids/);
  assert.match(page, /LetterDownloadGate/);
  assert.match(page, /purpose="seasonal-polaroid"/);
  // One export path shared with the result page.
  assert.match(page, /exportSeasonalPolaroidPng\(frameRef\.current\)/);
  assert.doesNotMatch(page, /toCanvas/);
  assert.match(exporter, /document\.fonts\?\.ready/);
  assert.match(exporter, /image\.decode/);
  assert.match(exporter, /cacheBust: false/);
  assert.match(exporter, /output\.width = SEASONAL_POLAROID_EXPORT_WIDTH/);
  assert.match(exporter, /SEASONAL_POLAROID_EXPORT_WIDTH = 1080/);
  assert.match(exporter, /SEASONAL_POLAROID_EXPORT_HEIGHT = 1620/);
  assert.match(exporter, /drawImage\(rendered, 0, 0, output\.width, output\.height\)/);
  assert.doesNotMatch(exporter, /toCanvas\(node,\s*\{[\s\S]*?width: 1080/);
  // Gallery cards use the shared base presentation, so the caption colour matches the result page.
  assert.match(page, /SEASONAL_POLAROID_FRAME_BASE_CLASS/);
  assert.doesNotMatch(page, /max-w-\[440px\] overflow-hidden bg-\[#F2E8D7\] text-\[#806A56\]/);
  assert.match(frame, /aspect-\[2\/3\]/);
  assert.match(frame, /template\.png.*z-0/);
  assert.match(frame, /left-\[16\.2%\].*top-\[15\.2%\].*z-10/);
  assert.match(frame, /memoLines\.slice\(0, 4\)/);
});

test("gallery navigation is additive and does not alter generation actions", () => {
  assert.match(choose, /href="\/my-polaroids"/);
  assert.match(result, /href="\/my-polaroids"/);
  assert.match(result, /onClick=\{onRegenerate\}/);
  assert.match(result, /onClick=\{onDownload\}/);
});

test("the existing result table keeps private owner-scoped storage", () => {
  assert.match(migration, /owner_user_id uuid not null/);
  assert.match(migration, /image_object_key text not null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /owner_user_id = auth\.uid\(\)/);
});
