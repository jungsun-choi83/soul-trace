import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("supabase/schema.sql", "utf8");
const photos = readFileSync("supabase/migration_add_life_archive_photos.sql", "utf8");
const guide = readFileSync("supabase/README.md", "utf8");

test("photo rows are structurally bound to a moment owned by the same user", () => {
  for (const sql of [photos, schema]) {
    assert.match(sql, /unique\s*\(moment_id, owner_user_id\)/i);
    assert.match(sql, /foreign key\s*\(moment_id, owner_user_id\)\s*references public\.life_archive_photo_moments\s*\(moment_id, owner_user_id\)\s*on delete cascade/i);
    assert.doesNotMatch(sql, /moment_id uuid not null references public\.life_archive_photo_moments\s*\(moment_id\)/i);
  }
});

test("canonical schema contains the final normalized archive and result model", () => {
  for (const table of [
    "soul_trace_profiles", "soul_trace_owners", "soul_trace_pets",
    "soul_trace_submissions", "soul_trace_legacy_links",
    "soul_trace_submission_answers", "life_archive_memories",
    "life_archive_photo_moments", "life_archive_photos",
  ]) assert.match(schema, new RegExp(`create table if not exists public\\.${table}\\b`, "i"));

  for (const column of ["generation_locale", "letter_title", "letter_ending_phrase", "letter_mode"]) {
    assert.match(schema, new RegExp(`\\b${column}\\b`));
  }
  assert.match(schema, /claim_soul_trace_legacy_records/);
  assert.match(schema, /sync_soul_trace_legacy_profile_trigger/);
  assert.match(schema, /sync_soul_trace_legacy_answer_trigger/);
  assert.match(schema, /values\s*\(\s*'life-archive-photos'/);
  assert.match(schema, /for insert to authenticated/);
  assert.match(schema, /for delete to authenticated/);
});

test("deployment guide records the exact manual migration order and secure-mode gate", () => {
  const names = [
    "migration_add_generation_locale.sql",
    "migration_add_life_archive_foundation.sql",
    "migration_enable_life_archive_memory_writes.sql",
    "migration_add_life_archive_photos.sql",
    "migration_add_persistent_letter_result.sql",
  ];
  let prior = -1;
  for (const name of names) {
    const position = guide.indexOf(name);
    assert.ok(position > prior, `${name} must appear in order`);
    prior = position;
  }
  assert.match(guide, /applied manually/i);
  assert.match(guide, /Vercel builds and deployments do not run/i);
  assert.match(guide, /NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE/);
  assert.match(guide, /Temporary Life Archive mode remains available/);
  assert.match(guide, /claim_soul_trace_legacy_records/);
  assert.match(guide, /preview and production as separate Supabase environments/i);
});

test("locale and persistent-result migrations match canonical column constraints", () => {
  const locale = readFileSync("supabase/migration_add_generation_locale.sql", "utf8");
  const result = readFileSync("supabase/migration_add_persistent_letter_result.sql", "utf8");
  assert.match(locale, /generation_locale is null or generation_locale in \('en', 'ko'\)/);
  assert.match(schema, /generation_locale text[\s\S]*?generation_locale is null or generation_locale in \('en', 'ko'\)/);
  for (const column of ["letter_title", "letter_ending_phrase", "letter_mode"]) {
    assert.match(result, new RegExp(`add column if not exists ${column}`));
    assert.match(schema, new RegExp(`\\b${column} text\\b`));
  }
});
