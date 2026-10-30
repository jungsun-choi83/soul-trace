import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");
const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8").replace(/\r\n/g, "\n");
const statusRoute = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
const migration = readFileSync("supabase/migration_ai_generation_seasonal_polaroid.sql", "utf8").replace(/\r\n/g, "\n");
const storageMigration = readFileSync("supabase/migration_ai_generation_seasonal_polaroid_storage.sql", "utf8");
const existingQueueMigration = readFileSync("supabase/migration_ai_generation_queue.sql", "utf8");
const safetyMigration = readFileSync("supabase/migration_ai_generation_safety.sql", "utf8");
const seasonalRoute = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
const admission = readFileSync("lib/seasonal-polaroid-admission.ts", "utf8");
const resultsMigration = readFileSync("supabase/migration_seasonal_polaroid_results.sql", "utf8");

test("the guard recognizes all three generation kinds with isolated Seasonal limits", () => {
  assert.match(guard, /AiGenerationKind = "letter" \| "visual_memory" \| "seasonal_polaroid"/);
  assert.match(guard, /letter: \{ windowSeconds: 600, ipLimit: 10, identityLimit: 2, ipDailyLimit: 30, identityDailyLimit: 6 \}/);
  assert.match(guard, /visual_memory: \{ windowSeconds: 600, ipLimit: 6, identityLimit: 0, ipDailyLimit: 15, identityDailyLimit: 0 \}/);
  assert.match(guard, /seasonal_polaroid: \{ windowSeconds: 600, ipLimit: 3, identityLimit: 0, ipDailyLimit: 8, identityDailyLimit: 0 \}/);
});

test("the worker routes each supported kind explicitly", () => {
  assert.match(worker, /case "letter":/);
  assert.match(worker, /case "visual_memory":/);
  assert.match(worker, /case "seasonal_polaroid":/);
  assert.match(worker, /processSeasonalPolaroidJob/);
  assert.match(worker, /generateSeasonalPolaroidImage/);
  assert.match(worker, /generateSeasonalPolaroidMemo/);
  assert.match(worker, /completeSeasonalPolaroidJob\(job\.request_hash, result\)/);
  assert.match(worker, /seasonal_result_persistence_failed/);
  assert.match(worker, /unsupported_generation_kind/);
  assert.match(worker, /case "seasonal_polaroid":\s*await processSeasonalPolaroidJob/);
});

test("Seasonal worker uses bounded retry behavior for invalid or unavailable inputs", () => {
  assert.match(worker, /await requeueSeasonalJob\(job, "invalid_seasonal_input"\)/);
  assert.match(worker, /p_max_attempts: 3|requeueAiGenerationJob/);
  assert.match(existingQueueMigration, /p_max_attempts integer default 3/);
});

test("the status endpoint accepts only the three supported kinds and preserves capability checks", () => {
  assert.match(statusRoute, /new Set\(\["letter", "visual_memory", "seasonal_polaroid"\]\)/);
  assert.match(statusRoute, /!GENERATION_KINDS\.has\(kind\)/);
  assert.match(statusRoute, /job\.generation_kind !== kind/);
  assert.match(statusRoute, /kind === "letter"/);
  assert.match(statusRoute, /SEASONAL_STATUS_ENABLED = isSeasonalPolaroidEnabled\(\)/);
  assert.match(statusRoute, /kind === "seasonal_polaroid" && !SEASONAL_STATUS_ENABLED/);
  assert.match(statusRoute, /seasonalPolaroidCapabilityMatches/);
  assert.match(statusRoute, /x-soul-trace-seasonal-capability/);
  assert.match(statusRoute, /kind: "private-proxy"/);
  assert.match(statusRoute, /aiGenerationIdentityHash/);
  assert.match(statusRoute, /Generation not found/);
});

test("the additive migration expands constraints and the admission RPC without changing old migrations", () => {
  assert.match(migration, /migration_ai_generation_safety\.sql/);
  assert.match(migration, /migration_ai_generation_queue\.sql/);
  assert.match(migration, /generation_kind in \('letter', 'visual_memory', 'seasonal_polaroid'\)/);
  assert.match(migration, /p_generation_kind not in \('letter', 'visual_memory', 'seasonal_polaroid'\)/);
  assert.match(migration, /create or replace function public\.acquire_ai_generation_job/);
  assert.match(migration, /grant execute on function public\.acquire_ai_generation_job/);
  assert.match(migration, /input_payload[\s\S]*input_storage_path[\s\S]*input_ready/);
  assert.match(migration, /ai-generation-inputs/);
  assert.doesNotMatch(existingQueueMigration, /seasonal_polaroid/);
  const acquireSignature = "p_idempotency_key text,\n  p_request_hash text,\n  p_generation_kind text,\n  p_ip_hash text,\n  p_identity_hash text,\n  p_window_seconds integer,\n  p_ip_limit integer,\n  p_identity_limit integer,\n  p_daily_window_seconds integer,\n  p_ip_daily_limit integer,\n  p_identity_daily_limit integer,\n  p_global_limit integer,\n  p_lease_seconds integer,\n  p_success_reuse_seconds integer";
  assert.equal((migration.match(new RegExp(acquireSignature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 1);
  assert.match(safetyMigration, /create or replace function public\.acquire_ai_generation_job/);
});

test("Seasonal migrations target only generation-kind checks and use attempt-scoped result objects", () => {
  assert.match(migration, /pg_get_constraintdef\(c\.oid\) ~\* 'generation_kind'/);
  assert.match(migration, /pg_get_constraintdef\(c\.oid\) ~\* 'letter'/);
  assert.match(migration, /pg_get_constraintdef\(c\.oid\) ~\* 'visual_memory'/);
  assert.doesNotMatch(migration, /pg_get_constraintdef\(c\.oid\) like '%generation_kind%'\s*\n\s*loop/);
  assert.match(resultsMigration, /job_id text not null,\s*\n\s*owner_user_id/);
  assert.match(resultsMigration, /seasonal-polaroid\/\[0-9a-f\]\{64\}\/result\/\[A-Za-z0-9_\-\]\{16,64\}\[\.\]jpg/);
  assert.match(resultsMigration, /if not exists \([\s\S]*pg_policies[\s\S]*Owners can read their seasonal polaroids/);
});

test("Seasonal public admission is disabled without exposing a job capability", () => {
  assert.match(seasonalRoute, /SEASONAL_POLAROID_GENERATION_ENABLED = isSeasonalPolaroidEnabled\(\)/);
  assert.match(seasonalRoute, /primaryPhoto/);
  assert.doesNotMatch(seasonalRoute, /secondaryPhoto|photoSecondary/);
  assert.match(seasonalRoute, /generationNonce/);
  assert.match(seasonalRoute, /seasonal_polaroid_unavailable/);
  assert.doesNotMatch(seasonalRoute, /visualMemoryGenerationCookie/);
  assert.doesNotMatch(seasonalRoute, /scheduleAiGenerationWorker/);
});

test("rate-limit checks remain keyed by generation kind", () => {
  assert.match(migration, /where generation_kind = p_generation_kind/);
  assert.match(migration, /insert into public\.ai_rate_limit_events\(generation_kind/);
  assert.match(migration, /p_generation_kind text/);
});

test("Seasonal input attachment is first-writer-wins without changing legacy kinds", () => {
  assert.match(storageMigration, /generation_kind <> 'seasonal_polaroid' or input_ready = false/);
  assert.match(storageMigration, /set_ai_generation_input/);
  assert.match(storageMigration, /grant execute/);
  assert.match(storageMigration, /migration_ai_generation_queue\.sql/);
  assert.doesNotMatch(storageMigration, /drop table|delete from public\.ai_generation_jobs/i);
  assert.match(storageMigration, /returns boolean/);
  assert.match(storageMigration, /returning true/);
});

test("Seasonal worker keeps inputs and results private", () => {
  assert.match(worker, /ai-generation-inputs/);
  assert.match(worker, /inputPhotos\.primary/);
  assert.doesNotMatch(worker, /inputPhotos\.secondary/);
  assert.match(worker, /kind: "private-object"/);
  assert.match(worker, /objectKey: resultPath/);
  assert.doesNotMatch(worker, /imageDataUrl/);
  assert.doesNotMatch(worker, /case "seasonal_polaroid"[\s\S]{0,500}api\/visual-memory/);
  assert.match(admission, /resultPath: seasonalPolaroidResultPath\(/);
  assert.match(admission, /payload\.resultPath !== seasonalPolaroidResultPath\(jobId, primaryAttempt\)/);
});

test("Seasonal worker generates from the primary photo only, even for a legacy two-photo job", () => {
  assert.doesNotMatch(worker, /secondaryDownload|secondaryPhoto|secondaryBytes/);
  assert.match(worker, /const imageReferenceCount = 1;/);
  assert.match(worker, /primary: \{ bytes: primaryBytes, name: primaryName, type: primaryType \},\n\s*\}\);/);
});

test("Seasonal worker finishes and stores the image before requesting the caption from it", () => {
  const imageStart = worker.indexOf("const imageResult = await generateSeasonalPolaroidImage");
  const imageStored = worker.indexOf("await uploadSeasonalPolaroidResultImage");
  const memoStart = worker.indexOf("const memoResult = await generateSeasonalPolaroidMemo");
  assert.ok(imageStart >= 0 && imageStored >= 0 && memoStart >= 0);
  assert.ok(imageStart < imageStored);
  assert.ok(imageStored < memoStart, "caption is written only after the image is safely stored");
  // A caption retry must reuse the stored image rather than regenerate it.
  assert.match(worker, /const existingImage = await downloadSeasonalPolaroidResultImage/);
  assert.match(worker, /image: \{ base64: Buffer\.from\(imageBytes\)/);
  assert.doesNotMatch(worker, /memoPromise/);
});

test("internal admission is prepared but not reachable from the disabled public route", () => {
  assert.match(admission, /acquireAiGeneration/);
  assert.match(admission, /seasonal_polaroid/);
  assert.match(admission, /createSeasonalPolaroidInputAttempt/);
  assert.match(admission, /attachAiGenerationInput/);
  assert.match(admission, /scheduleAiGenerationWorker/);
  assert.match(seasonalRoute, /SEASONAL_POLAROID_GENERATION_ENABLED = isSeasonalPolaroidEnabled\(\)/);
  assert.match(seasonalRoute, /if \(!SEASONAL_POLAROID_GENERATION_ENABLED\)/);
});
