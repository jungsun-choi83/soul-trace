import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync("app/life-archive/page.tsx", "utf8");
const ui = readFileSync("components/life-archive-preview.tsx", "utf8");
const route = readFileSync("app/api/life-archive/memories/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migration_enable_life_archive_memory_writes.sql",
  "utf8",
);

describe("Life Archive Phase 4 memories", () => {
  it("keeps the prepared secure memory API limited to story, title, and date", () => {
    assert.match(ui, /type="text"/);
    assert.match(ui, /type="date"/);
    assert.match(ui, /<textarea[\s\S]*?required/);
    assert.doesNotMatch(route, /photo|video|type="file"/i);
  });

  it("validates without changing the exact submitted writing", () => {
    assert.match(route, /!story\.trim\(\)/);
    assert.match(route, /story,/);
    assert.match(route, /title: title\.trim\(\) \? title : null/);
    assert.doesNotMatch(route, /story:\s*story\.trim\(\)/);
    assert.doesNotMatch(route, /translat/i);
  });

  it("derives owner, pet, and submission on the server", () => {
    assert.match(route, /ACTIVE_SUBMISSION_COOKIE/);
    assert.match(route, /auth\.getUser\(\)/);
    assert.match(route, /\.eq\("owner_user_id", userData\.user\.id\)/);
    assert.match(route, /owner_user_id: archive\.userId/);
    assert.match(route, /pet_id: archive\.submission\.pet_id/);
    assert.match(route, /submission_id: archive\.submission\.submission_id/);
  });

  it("protects both insert and delete with authenticated RLS", () => {
    assert.match(migration, /for insert to authenticated/);
    assert.match(migration, /for delete to authenticated/);
    assert.match(migration, /owner_user_id = auth\.uid\(\)/);
    assert.match(route, /export async function DELETE/);
  });

  it("loads archive memories separately from original answers", () => {
    assert.match(page, /from\("life_archive_memories"\)/);
    assert.match(page, /from\("soul_trace_submission_answers"\)/);
    assert.match(ui, /memories\.map/);
  });

  it("does not add editing yet", () => {
    assert.doesNotMatch(route, /export async function (?:PUT|PATCH)/);
    assert.doesNotMatch(migration, /for update to authenticated/i);
  });
});
