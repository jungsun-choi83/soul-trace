import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("supabase/schema.sql", "utf8");
const photos = readFileSync("supabase/migration_add_life_archive_photos.sql", "utf8");
const guide = readFileSync("supabase/README.md", "utf8");
const partnerFoundation = readFileSync("supabase/migration_add_partners.sql", "utf8");
const partnerTrack = readFileSync("supabase/migration_add_partner_track_and_rate.sql", "utf8");
const partnerTypes = readFileSync(
  "supabase/migration_add_partner_types_grooming_pension.sql",
  "utf8",
);

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
    "migration_add_partners.sql",
    "migration_add_partner_track_and_rate.sql",
    "migration_add_partner_types_grooming_pension.sql",
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

test("partner migrations preserve rows and produce the canonical four-type model", () => {
  assert.match(partnerFoundation, /create table if not exists public\.partners/i);
  assert.match(partnerFoundation, /create table if not exists public\.partner_codes/i);
  assert.match(partnerFoundation, /code\s+text primary key/i);
  assert.match(partnerFoundation, /active\s+boolean not null default true/i);
  assert.match(partnerFoundation, /alter table public\.partners enable row level security/i);
  assert.match(partnerFoundation, /alter table public\.partner_codes enable row level security/i);
  assert.match(partnerTrack, /add column if not exists share_rate/i);
  assert.match(partnerTrack, /add column if not exists track/i);
  assert.match(
    partnerTypes,
    /check \(partner_type in \('HOSPITAL', 'FUNERAL', 'GROOMING', 'PENSION'\)\)/i,
  );
  for (const migration of [partnerFoundation, partnerTypes]) {
    assert.doesNotMatch(
      migration,
      /\b(?:delete from|truncate|drop table|update public\.partners|update public\.partner_codes)\b/i,
    );
  }

  assert.match(schema, /create table if not exists public\.partners/i);
  assert.match(schema, /create table if not exists public\.partner_codes/i);
  assert.match(schema, /code text primary key/i);
  assert.match(
    schema,
    /partner_type text not null[\s\S]*?'HOSPITAL'[\s\S]*?'FUNERAL'[\s\S]*?'GROOMING'[\s\S]*?'PENSION'/i,
  );
  assert.match(schema, /share_rate numeric\(6, 4\) not null default 0/i);
  assert.match(
    schema,
    /track text check \(track is null or track in \('living', 'memorial'\)\)/i,
  );
  assert.match(
    schema,
    /partner_id text references public\.partners \(partner_id\) on delete set null/i,
  );
  assert.match(schema, /partner_code text/i);
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
