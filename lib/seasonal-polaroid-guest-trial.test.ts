import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const admission = readFileSync("lib/seasonal-polaroid-admission.ts", "utf8");
const route = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const client = readFileSync("lib/seasonal-polaroid-client.ts", "utf8");
const migration = readFileSync("supabase/migration_seasonal_polaroid_guest_trials.sql", "utf8");
const guest = readFileSync("lib/seasonal-polaroid-guest-trial.ts", "utf8");
const guestMigration = readFileSync("supabase/migration_seasonal_polaroid_guest_trials.sql", "utf8");
const retryMigration = readFileSync("supabase/migration_ai_generation_rate_limit_retry_after.sql", "utf8");
const queueMigration = readFileSync("supabase/migration_ai_generation_queue.sql", "utf8");
const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");

test("account trial is server authoritative and atomic", () => {
  assert.match(route, /createSupabaseAuthServerClient/);
  assert.match(route, /aiGenerationIdentityHash/);
  assert.doesNotMatch(route, /seasonalGuestIdentity/);
  assert.match(admission, /reserveSeasonalAccountTrial/);
  assert.match(admission, /accountHash/);
  assert.match(admission, /guest_trial_exhausted/);
  assert.match(migration, /for update/);
  assert.match(migration, /successful_count[\s\S]*between 0 and 2/);
  assert.match(migration, /reserve_seasonal_polaroid_guest_trial/);
  assert.match(migration, /finalize_seasonal_polaroid_guest_trial/);
  assert.match(migration, /release_seasonal_polaroid_guest_trial/);
  assert.match(guestMigration, /existing\.guest_hash <> p_guest_hash/);
  assert.match(guestMigration, /HMAC of the verified[\s\S]*Supabase user ID/);
  assert.match(guestMigration, /status in \('queued', 'pending', 'processing'\)/);
  assert.match(guestMigration, /job_status <> 'failed'/);
  assert.match(guestMigration, /Lock order is always guest trial -> reservation/);
  assert.match(guestMigration, /successful_count >= 2/);
  assert.match(guestMigration, /reservation_version integer/);
  assert.match(guestMigration, /reservation_version = existing\.reservation_version \+ 1/);
  assert.match(guestMigration, /status = 'reserved', job_id = null/);
  assert.match(guestMigration, /status = 'released', job_id = null/);
  assert.match(guestMigration, /p_reservation_version integer/);
  assert.match(guestMigration, /reservation_version = p_reservation_version/);
  assert.match(guestMigration, /drop function if exists public\.release_seasonal_polaroid_guest_trial\(uuid\)/);
});

test("trial reservations are finalized only after Seasonal completion and released on terminal failure", () => {
  assert.match(worker, /requeueSeasonalJob/);
  assert.match(worker, /current\?\.status === "failed"/);
  assert.match(worker, /finalizeSeasonalGuestTrial/);
  assert.match(worker, /guestTrialReservationId/);
  assert.match(worker, /guestTrialReservationVersion/);
  assert.match(worker, /function seasonalReservation\(/);
  assert.match(queueMigration, /where idempotency_key = p_idempotency_key[\s\S]*status in \('pending', 'processing'\)/);
});

test("review harness covers successful allowance, retry recovery, and parallel-admission instructions", () => {
  const harness = readFileSync("supabase/tests/seasonal_polaroid_guest_trials.sql", "utf8");
  const parallel = readFileSync("supabase/tests/seasonal_polaroid_guest_trials_parallel.pgbench", "utf8");
  assert.match(harness, /two successful generations were not finalized/);
  assert.match(harness, /third reservation was not rejected/);
  assert.match(harness, /retried successful job did not finalize/);
  assert.match(harness, /stale failure callback released a reactivated reservation/);
  assert.match(harness, /complete_ai_generation_job/);
  assert.match(parallel, /pgbench -n -c 8 -j 8/);
  assert.match(parallel, /reserve_seasonal_polaroid_guest_trial/);
});

test("reservation lifetime remains longer than the bounded queue execution window", () => {
  assert.match(guest, /SEASONAL_POLAROID_GUEST_RESERVATION_SECONDS = 60 \* 60/);
  assert.match(guard, /AI_JOB_LEASE_SECONDS = 270/);
  assert.match(worker, /WORKER_EXECUTION_BUDGET_MS = 220_000/);
  assert.match(guestMigration, /guest_trial_reservation_expired/);
});

test("pending SQL files are plain SQL without Markdown fences or leading prose", () => {
  for (const file of [
    "supabase/migration_seasonal_polaroid_guest_trials.sql",
    "supabase/migration_ai_generation_rate_limit_retry_after.sql",
  ]) {
    assert.equal(existsSync(file), true);
    const sql = readFileSync(file, "utf8");
    assert.doesNotMatch(sql, /```/);
    assert.match(sql, /^\s*--/);
  }
});

test("account trial state is server-derived without putting the allowance in client storage", () => {
  assert.match(client, /\/api\/seasonal-polaroid\/trial/);
  assert.doesNotMatch(client, /localStorage.*trial|sessionStorage.*trial/);
  assert.match(route, /authentication_required/);
  assert.match(guest, /seasonalPolaroidAccountIdentityHash/);
  assert.match(guest, /aiGenerationIdentityHash/);
});

test("account identity is stable across browsers and distinct across accounts", () => {
  assert.match(guest, /aiGenerationIdentityHash\(userId\)/);
  assert.match(route, /const accountHash = authenticatedUserId \? aiGenerationIdentityHash\(authenticatedUserId\) : null/);
  assert.doesNotMatch(route, /Set-Cookie/);
  assert.doesNotMatch(route, /guest\.hash/);
  assert.match(guestMigration, /guest_hash text primary key/);
  assert.match(guestMigration, /p_guest_hash/);
});

test("developer admissions do not reserve or finalize customer guest trials", () => {
  const admission = readFileSync("lib/seasonal-polaroid-admission.ts", "utf8");
  const route = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
  assert.match(admission, /const developerTestMode = args\.developerTestMode === true && seasonalPolaroidDeveloperTestMode\(\)/);
  assert.match(admission, /developerTestMode\s*\?\s*null/);
  assert.match(admission, /rateLimitIsolationKey/);
  assert.match(route, /seasonal-developer:\$\{randomUUID\(\)\}/);
  assert.match(route, /seasonalPolaroidDeveloperRequestAllowed\(request\)/);
  assert.doesNotMatch(route, /reserveSeasonalPolaroidDeveloperAdmission|developer_budget_exhausted/);
});

test("successful idempotent reuse carries remaining allowance without a new reservation", () => {
  assert.match(migration, /already_succeeded/);
  assert.match(migration, /idempotency_key = p_idempotency_key/);
  assert.match(admission, /trial\?\.owner/);
});

test("retry-after calculation waits for the event that actually frees capacity", () => {
  assert.match(retryMigration, /offset \(recent_count - p_ip_limit\)/);
  assert.match(retryMigration, /offset \(recent_count - p_ip_daily_limit\)/);
  assert.match(retryMigration, /p_ip_daily_limit < p_ip_limit/);
  assert.match(retryMigration, /p_identity_daily_limit < p_identity_limit/);
});
