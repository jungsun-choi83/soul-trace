import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migration_add_life_archive_foundation.sql", import.meta.url),
  "utf8",
);
const ownerAuth = readFileSync(
  new URL("./life-archive-auth.ts", import.meta.url),
  "utf8",
);
const authCallback = readFileSync(
  new URL("../app/auth/confirm/route.ts", import.meta.url),
  "utf8",
);
const authConfirmation = readFileSync(
  new URL("./auth-confirm.ts", import.meta.url),
  "utf8",
);
const resultFlow = readFileSync(
  new URL("../components/soul-trace-flow.tsx", import.meta.url),
  "utf8",
);

test("Life Archive uses ID relationships and preserves the existing letter ID", () => {
  for (const field of [
    "user_id",
    "pet_id",
    "submission_id",
    "letter_id",
    "memory_id",
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`));
  }
  assert.match(migration, /generated_letter text not null/);
  assert.match(migration, /generation_locale text/);
});

test("legacy records are claimed only by a verified authenticated email", () => {
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /email_confirmed_at is not null/);
  assert.match(migration, /owner_user_id = verified_user_id/);
  assert.match(migration, /grant execute[\s\S]+to authenticated/);
});

test("original answers stay separate from new archive memories", () => {
  assert.match(migration, /soul_trace_submission_answers/);
  assert.match(migration, /life_archive_memories/);
  assert.match(migration, /Orders 1-5 are memory answers; 6-8 are letter-tone answers/);
  assert.doesNotMatch(migration, /translate\s*\(/i);
});

test("Phase 2 does not grant memory creation access", () => {
  assert.doesNotMatch(
    migration,
    /create policy[\s\S]*?on public\.life_archive_memories for insert/i,
  );
});

test("verification reuses the email stored behind letter_id", () => {
  assert.match(ownerAuth, /\.eq\("letter_id", letterId\)/);
  assert.match(ownerAuth, /email: data\.user_email/);
  assert.doesNotMatch(ownerAuth, /email:\s*string/);
  assert.match(authCallback, /authenticateAuthCallback/);
  assert.match(authConfirmation, /verifyOtp/);
  assert.match(authConfirmation, /claim_soul_trace_legacy_records/);
});

test("the result connection does not collect the owner's email again", () => {
  assert.match(resultFlow, /\/api\/life-archive\/access/);
  assert.match(resultFlow, /JSON\.stringify\(\{ letterId \}\)/);
});
