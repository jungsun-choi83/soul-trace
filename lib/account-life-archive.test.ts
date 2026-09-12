import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migration_account_archive_persistence.sql", "utf8");
const archivePage = readFileSync("app/life-archive/page.tsx", "utf8");
const generation = readFileSync("app/api/generate-letter/route.ts", "utf8");
const preview = readFileSync("components/life-archive-preview.tsx", "utf8");
const videos = readFileSync("app/api/life-archive/videos/route.ts", "utf8");
const photos = readFileSync("app/api/life-archive/photos/route.ts", "utf8");
const memories = readFileSync("app/api/life-archive/memories/route.ts", "utf8");
const confirmation = readFileSync("lib/auth-confirm.ts", "utf8");

test("secure archive discovers every owned pet and submission without an active cookie", () => {
  assert.match(archivePage, /from\("soul_trace_pets"\)[\s\S]*?eq\("owner_user_id", userData\.user\.id\)/);
  assert.match(archivePage, /from\("soul_trace_submissions"\)[\s\S]*?eq\("owner_user_id", userData\.user\.id\)/);
  assert.match(archivePage, /preferredSubmissionId = requestedSubmissionId \?\?/);
  assert.doesNotMatch(archivePage, /if \(!submissionId\) return/);
  assert.match(preview, /accountPets\.map/);
});

test("stable pet identity is explicit, owner-validated, and never name-merged", () => {
  assert.match(generation, /body\.petId/);
  assert.match(generation, /eq\("pet_id", requestedPetId\)[\s\S]*?eq\("owner_user_id", authData\.user\.id\)/);
  assert.match(migration, /if new\.pet_id is not null[\s\S]*?pets\.owner_user_id = account_user_id/);
  assert.match(migration, /values \(new\.user_email, linked_pet_id, linked_submission_id, new\.letter_id\)/);
  assert.match(migration, /drop constraint if exists soul_trace_legacy_links_pet_id_key/);
  assert.doesNotMatch(migration, /lower\(.*pet_name|pet_name\s*=\s*new\.pet_name.*select/i);
});

test("multiple letters remain separate and newest-first under one pet", () => {
  assert.match(migration, /insert into public\.soul_trace_submissions/);
  assert.match(migration, /new\.letter_id/);
  assert.match(migration, /owner_user_id, pet_id, created_at desc/);
  assert.match(archivePage, /order\("created_at", \{ ascending: false \}\)/);
  assert.match(preview, /letter\.submissionId/);
});

test("all canonical service channels persist directly on normalized submissions", () => {
  for (const channel of ["pension", "grooming", "hospital", "funeral"]) assert.match(migration, new RegExp(channel));
  assert.match(generation, /service_channel = options\.serviceChannel/);
  assert.match(archivePage, /service_channel/);
});

test("text, photo, and video APIs accept account-selected submissions and recheck ownership", () => {
  for (const source of [memories, photos, videos]) {
    assert.match(source, /submissionId/);
    assert.match(source, /owner_user_id/);
  }
  assert.match(photos, /eq\("owner_user_id", user\.id\)/);
  assert.match(videos, /eq\("owner_user_id", user\.id\)/);
});

test("private videos validate, persist, sign, update, and delete", () => {
  assert.match(migration, /create table if not exists public\.life_archive_videos/);
  assert.match(migration, /life-archive-videos', false, 52428800/);
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
  assert.match(videos, /TYPES = new Set\(\["video\/mp4", "video\/webm", "video\/quicktime"\]\)/);
  assert.match(videos, /MAX_BYTES = 50 \* 1024 \* 1024/);
  assert.match(videos, /createSignedUrl/);
  assert.match(videos, /export async function PATCH/);
  assert.match(videos, /export async function DELETE/);
});

test("legacy claims stay discoverable and cannot make authentication depend on claiming", () => {
  assert.match(migration, /owner_user_id = coalesce\(owner_user_id, account_user_id\)/);
  assert.doesNotMatch(confirmation, /auth\.signOut\(\)/);
  assert.match(confirmation, /logAuthFailure\("callback-legacy-claim"/);
});
