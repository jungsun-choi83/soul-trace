import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migration_seasonal_polaroid_durable_persistence.sql", "utf8").replace(/\r\n/g, "\n");
const admission = readFileSync("lib/seasonal-polaroid-admission.ts", "utf8");
const persistence = readFileSync("lib/seasonal-polaroid-persistence.ts", "utf8");
const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const trials = readFileSync("supabase/migration_seasonal_polaroid_guest_trials.sql", "utf8");
const postgresHarness = readFileSync("supabase/tests/seasonal_polaroid_durable_persistence.sql", "utf8");

test("Seasonal ownership is isolated from the shared Letter and Visual Memory queue", () => {
  assert.match(migration, /create table if not exists public\.seasonal_polaroid_job_owners/);
  assert.match(migration, /generation_kind = 'seasonal_polaroid'/);
  assert.match(migration, /references public\.ai_generation_jobs\(idempotency_key\)/);
  assert.match(migration, /references public\.soul_trace_owners\(user_id\)/);
  assert.doesNotMatch(migration, /alter table public\.ai_generation_jobs/);
  assert.match(admission, /attachSeasonalPolaroidJobOwner/);
  assert.match(admission, /ownerUserId: args\.identity/);
  assert.match(migration, /insert into public\.soul_trace_owners\(user_id\)/);
});

test("client identity is never trusted for owner association", () => {
  assert.match(persistence, /ownerIdentityHash/);
  assert.match(persistence, /attach_seasonal_polaroid_job_owner/);
  assert.match(admission, /aiGenerationIdentityHash\(args\.identity\)/);
  assert.match(admission, /ownerIdentityHash/);
  assert.match(migration, /owner_identity_hash = p_owner_identity_hash/);
});

test("completion persists the gallery row before marking an authenticated job succeeded", () => {
  assert.match(worker, /completeSeasonalPolaroidJob\(job\.request_hash, result\)/);
  assert.match(worker, /seasonal_result_persistence_failed/);
  assert.match(migration, /insert into public\.seasonal_polaroid_results/);
  assert.match(migration, /on conflict \(result_id\) do nothing/);
  assert.match(migration, /status in \('pending', 'processing'\)/);
  assert.match(migration, /set status = 'succeeded', result = p_result/);
  assert.doesNotMatch(worker, /completeAiGeneration\("seasonal_polaroid"/);
});

test("duplicate completion accepts only the same durable result owner and job", () => {
  assert.match(migration, /existing_result\.job_id <> p_idempotency_key/);
  assert.match(migration, /existing_result\.owner_user_id <> owner_row\.owner_user_id/);
  assert.match(migration, /if job_row\.status = 'succeeded' then/);
  assert.match(migration, /return true;/);
});

test("terminal completion is rejected before any gallery write", () => {
  const statusGuard = migration.indexOf("if job_row.status not in ('pending', 'processing') then");
  const galleryInsert = migration.indexOf("insert into public.seasonal_polaroid_results(");
  assert.ok(statusGuard >= 0, "the completion RPC must guard queue state");
  assert.ok(galleryInsert > statusGuard, "terminal state must be checked before gallery writes");
  assert.match(migration, /Failed, queued,[\s\S]{0,100}no write side effects/);
  assert.match(migration, /raise exception 'seasonal completion state changed before commit'/);
  assert.match(postgresHarness, /late completion after failure was accepted/);
  assert.match(postgresHarness, /repeated late completion after failure was accepted/);
});

test("completion rejects null or malformed memo and pet fields without throwing", () => {
  assert.match(migration, /memo_lines jsonb;/);
  assert.match(migration, /memo_lines := p_result #> '\{memo,lines\}'/);
  assert.match(migration, /memo_locale is null/);
  assert.match(migration, /pet_status is null/);
  assert.match(migration, /memo_lines is null/);
  assert.match(migration, /jsonb_typeof\(memo_lines\) is distinct from 'array'/);
  assert.match(migration, /if jsonb_array_length\(memo_lines\) <> 4 then/);
  assert.doesNotMatch(migration, /case\s+when jsonb_typeof\(memo_lines\)/);
  assert.match(postgresHarness, /missing memo locale was accepted/);
  assert.match(postgresHarness, /null pet status was accepted/);
  assert.match(postgresHarness, /non-array memo lines were accepted/);
});

test("completion binds the generated image object to the exact queue job", () => {
  assert.match(migration, /split_part\(image_key, '\/', 2\) is distinct from p_idempotency_key/);
  assert.match(postgresHarness, /object key for another job was accepted/);
  assert.match(postgresHarness, /wrong object key created a gallery row/);
});

test("succeeded completion verifies the existing result identity before idempotent success", () => {
  const succeededGuard = migration.indexOf("if job_row.status = 'succeeded' then");
  const succeededResultLookup = migration.indexOf("where result_id = result_uuid", succeededGuard);
  assert.ok(succeededGuard >= 0);
  assert.ok(succeededResultLookup > succeededGuard);
  assert.match(migration, /existing_result\.job_id <> p_idempotency_key/);
  assert.match(migration, /existing_result\.owner_user_id <> owner_row\.owner_user_id/);
  assert.match(migration, /existing_result\.image_object_key <> image_key/);
  assert.match(migration, /job_row\.result->>'resultId' <> result_id_text/);
  assert.match(postgresHarness, /repeated active completion was not idempotent/);
});

test("owner attachment validates before creating the owner registry row", () => {
  const queueCheck = migration.indexOf("Validate the queue row and any existing association");
  const ownerInsert = migration.indexOf("insert into public.soul_trace_owners(user_id)");
  assert.ok(queueCheck >= 0);
  assert.ok(ownerInsert > queueCheck);
  assert.match(migration, /seasonal owner association changed before commit/);
  assert.match(postgresHarness, /invalid owner attachment left an owner row/);
});

test("persistence failures remain bounded retries and do not consume a trial", () => {
  assert.match(worker, /await requeueSeasonalJob\(job, "seasonal_result_persistence_failed"\)/);
  assert.match(worker, /if \(current\?\.status === "failed"\) await releaseSeasonalGuestTrial/);
  assert.match(worker, /requeueSeasonalJob\(job, "seasonal_result_persistence_failed"\)/);
  assert.match(trials, /status = 'released'/);
});

test("successful Seasonal completion still finalizes the existing two-generation reservation", () => {
  const persistedAt = worker.indexOf("completeSeasonalPolaroidJob(job.request_hash, result)");
  const finalizedAt = worker.indexOf("await finalizeSeasonalGuestTrial");
  assert.ok(persistedAt >= 0, "the Seasonal worker must persist before completion");
  assert.ok(finalizedAt > persistedAt, "trial finalization must happen after durable completion");
  assert.match(trials, /successful_count integer not null default 0 check \(successful_count between 0 and 2\)/);
  assert.match(trials, /successful_count \+ active_reserved >= 2/);
  assert.match(trials, /successful_count = successful_count \+ 1/);
});
