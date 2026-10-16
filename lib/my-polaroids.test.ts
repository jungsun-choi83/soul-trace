import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/my-polaroids/route.ts", "utf8");
const page = readFileSync("components/my-polaroids-page.tsx", "utf8");
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
  assert.match(page, /toCanvas/);
  assert.match(page, /width: 1080/);
  assert.match(page, /height: 1350/);
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
