import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migration_ai_generation_queue.sql", "utf8");
const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const statusRoute = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
const letterRoute = readFileSync("app/api/generate-letter/route.ts", "utf8");
const visualRoute = readFileSync("app/api/visual-memory/route.ts", "utf8");
const trigger = readFileSync("lib/ai-generation-worker-trigger.ts", "utf8");
const supabaseCron = readFileSync("supabase/migration_ai_generation_supabase_cron.sql", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

test("capacity-full admissions become durable queued jobs, not capacity 429s", () => {
  assert.match(migration, /status in \('pending', 'queued', 'processing', 'succeeded', 'failed'\)/);
  assert.match(migration, /next_status := case when active_count < p_global_limit and queued_count = 0 then 'processing' else 'queued' end/);
  assert.match(migration, /'decision', case when next_status = 'processing' then 'acquired' else 'queued' end/);
  assert.match(migration, /active_count < p_global_limit and queued_count = 0/);
  assert.match(letterRoute, /decision === "acquired" \|\| admission\.decision === "queued"/);
  assert.match(visualRoute, /decision === "acquired" \|\| admission\.decision === "queued"/);
});

test("FIFO workers claim atomically and use leases for crash recovery", () => {
  assert.match(migration, /order by created_at asc/);
  assert.match(migration, /for update\s+skip locked/);
  assert.match(migration, /stale_processing_recovered/);
  assert.match(migration, /attempt_count >= 3/);
  assert.match(worker, /claimAiGenerationJobs/);
  assert.match(worker, /Promise\.allSettled/);
});

test("duplicate queued and processing jobs are returned by idempotency lookup", () => {
  assert.match(migration, /current_job\.status in \('queued', 'pending'\)/);
  assert.match(migration, /current_job\.status = 'processing'/);
  assert.match(migration, /same logical request, not a new admission/);
  assert.match(migration, /set_ai_generation_input/);
  assert.match(letterRoute, /readAiGenerationJob/);
  assert.match(visualRoute, /readAiGenerationJob/);
});

test("queued results are polled through an ownership-protected status endpoint", () => {
  assert.match(statusRoute, /status === "succeeded"/);
  assert.match(statusRoute, /aiGenerationIdentityHash/);
  assert.match(statusRoute, /Generation not found/);
  assert.match(readFileSync("components/soul-trace-flow.tsx", "utf8"), /waitForAiGenerationResult/);
  assert.match(readFileSync("components/visual-memory-promo.tsx", "utf8"), /api\/ai-generation\/status/);
});

test("Visual Memory queued input uses private storage and worker retries are bounded", () => {
  assert.match(migration, /ai-generation-inputs/);
  assert.match(visualRoute, /storage\.from\("ai-generation-inputs"\)/);
  assert.match(worker, /download\(job\.input_storage_path\)/);
  assert.match(worker, /requeueAiGenerationJob/);
  assert.match(migration, /p_max_attempts integer default 3/);
});

test("automatic processing uses Supabase Cron as the recovery scheduler", () => {
  assert.doesNotMatch(vercel, /"crons"/);
  assert.doesNotMatch(vercel, /\* \* \* \* \*/);
  assert.match(supabaseCron, /pg_cron/);
  assert.match(supabaseCron, /pg_net/);
  assert.match(supabaseCron, /vault\.decrypted_secrets/);
  assert.match(supabaseCron, /net\.http_post/);
  assert.match(supabaseCron, /cron\.schedule/);
  assert.match(supabaseCron, /soul_trace_ai_worker_url/);
  assert.match(supabaseCron, /soul_trace_cron_secret/);
  assert.match(supabaseCron, /timeout_milliseconds := 230000/);
  assert.doesNotMatch(supabaseCron, /create\s+extension/i);
  assert.match(worker, /CRON_SECRET/);
});

test("new queued work wakes the authenticated worker after durable input attachment", () => {
  assert.match(letterRoute, /scheduleAiGenerationWorker\(request, \{ queuedKnown: true \}\)/);
  assert.match(visualRoute, /scheduleAiGenerationWorker\(request, \{ queuedKnown: true \}\)/);
  assert.match(trigger, /after\(async \(\) =>/);
  assert.match(trigger, /x-soul-trace-ai-worker-token/);
  assert.match(trigger, /AI_GENERATION_WORKER_SECRET/);
  assert.match(trigger, /catch \(error\)/);
  assert.match(trigger, /durable Cron worker will recover it/);
  assert.match(letterRoute, /return guardHttpResponse\(admission\)/);
  assert.match(visualRoute, /return guardHttpResponse\(admission\)/);
});

test("completion wakes only when ready queued work exists and internal workers do not recurse", () => {
  assert.match(trigger, /select\("idempotency_key"\)/);
  assert.match(trigger, /\.eq\("status", "queued"\)/);
  assert.match(trigger, /input_ready/);
  assert.match(trigger, /\.limit\(1\)/);
  assert.match(trigger, /bounded continuation loop/);
  assert.match(worker, /WORKER_MAX_ROUNDS = 4/);
  assert.match(worker, /WORKER_EXECUTION_BUDGET_MS/);
});

test("worker drains bounded continuation rounds while PostgreSQL remains authoritative", () => {
  assert.match(worker, /while \(/);
  assert.match(worker, /claimAiGenerationJobs\(\)/);
  assert.match(worker, /Promise\.allSettled/);
  assert.match(worker, /jobs\.length === 0/);
  assert.match(migration, /for update\s+skip locked/);
  assert.match(migration, /status = 'processing' and lease_expires_at > now\(\)/);
});
