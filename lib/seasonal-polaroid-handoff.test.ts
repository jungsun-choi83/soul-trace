import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");
const admission = readFileSync("lib/seasonal-polaroid-admission.ts", "utf8");
const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const trigger = readFileSync("lib/ai-generation-worker-trigger.ts", "utf8");
const seasonalRoute = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
const queueMigration = readFileSync("supabase/migration_ai_generation_queue.sql", "utf8");

test("Seasonal acquired jobs use an atomic input-ready processing-to-queued handoff", () => {
  assert.match(guard, /handoffAiGenerationJob/);
  assert.match(guard, /\.eq\("status", "processing"\)/);
  assert.match(guard, /\.eq\("input_ready", true\)/);
  assert.match(guard, /\.gt\("lease_expires_at", now\)/);
  assert.match(guard, /status: "queued"/);
  assert.match(guard, /lease_expires_at: null/);
  assert.match(guard, /next_attempt_at: now/);
});

test("Seasonal admission preserves lease recovery if the atomic handoff is unavailable", () => {
  assert.match(admission, /handoffAiGenerationJob\(/);
  assert.match(admission, /Do not blindly requeue here/);
  assert.match(admission, /stale[\s\S]*recovery path/);
  assert.match(admission, /scheduleAiGenerationWorker\(args\.request, \{ queuedKnown: true \}\)/);
  assert.match(admission, /scheduleAiGenerationWorker\(args\.request\)/);
});

test("duplicate queued requests can wake a durable job without replacing its inputs", () => {
  assert.match(admission, /if \(existing\?\.input_ready\)/);
  assert.match(admission, /duplicate request can safely wake/);
  assert.match(admission, /scheduleAiGenerationWorker\(args\.request, \{ queuedKnown: true \}\)/);
  assert.match(admission, /return decision;/);
});

test("the normal Seasonal path still uses the explicit worker branch and queue claim", () => {
  assert.match(worker, /claimAiGenerationJobs\(\)/);
  assert.match(worker, /case "seasonal_polaroid":\s*await processSeasonalPolaroidJob/);
  assert.match(worker, /completeAiGeneration\("seasonal_polaroid"/);
  assert.match(trigger, /x-soul-trace-ai-worker-token/);
  assert.doesNotMatch(seasonalRoute, /app\/api\/visual-memory/);
});

test("existing worker authentication and public feature gating remain intact", () => {
  assert.match(worker, /AI_GENERATION_WORKER_SECRET/);
  assert.match(worker, /CRON_SECRET/);
  assert.match(seasonalRoute, /if \(!SEASONAL_POLAROID_GENERATION_ENABLED\)/);
  assert.match(seasonalRoute, /seasonal_polaroid_unavailable/);
});

test("the atomic handoff uses queue-schema columns and leaves claiming to the service-role RPC", () => {
  for (const column of ["status", "lease_expires_at", "input_ready", "next_attempt_at", "updated_at"]) {
    assert.ok(queueMigration.includes(column));
  }
  assert.match(queueMigration, /claim_ai_generation_jobs/);
  assert.match(queueMigration, /grant execute on function public/);
  assert.match(queueMigration, /service_role/);
});
