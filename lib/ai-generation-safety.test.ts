import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyAiUpstreamFailure } from "./ai-generation-errors.ts";

const migration = readFileSync("supabase/migration_ai_generation_safety.sql", "utf8");
const letterRoute = readFileSync("app/api/generate-letter/route.ts", "utf8");
const visualRoute = readFileSync("app/api/visual-memory/route.ts", "utf8");
const letterClient = readFileSync("components/soul-trace-flow.tsx", "utf8");
const visualClient = readFileSync("components/visual-memory-promo.tsx", "utf8");
const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");

type Status = "pending" | "succeeded" | "failed";
type Job = { status: Status; result?: object };

function claim(jobs: Map<string, Job>, key: string) {
  const current = jobs.get(key);
  if (current?.status === "pending") return { decision: "pending" } as const;
  if (current?.status === "succeeded") return { decision: "succeeded", result: current.result } as const;
  jobs.set(key, { status: "pending" });
  return { decision: "acquired" } as const;
}

test("duplicated letter request reuses one durable job", () => {
  const jobs = new Map<string, Job>();
  assert.equal(claim(jobs, "letter:same").decision, "acquired");
  jobs.set("letter:same", { status: "succeeded", result: { letter: "saved" } });
  assert.deepEqual(claim(jobs, "letter:same"), {
    decision: "succeeded",
    result: { letter: "saved" },
  });
  assert.match(letterRoute, /X-Idempotent-Replay/);
  assert.match(letterRoute, /completeAiGeneration\("letter"/);
});

test("duplicated Visual Memory request reuses one durable job", () => {
  const jobs = new Map<string, Job>();
  assert.equal(claim(jobs, "visual:same").decision, "acquired");
  jobs.set("visual:same", { status: "succeeded", result: { imageDataUrl: "data:image/jpeg;base64,x" } });
  assert.equal(claim(jobs, "visual:same").decision, "succeeded");
  assert.match(visualRoute, /photoHash/);
  assert.match(visualRoute, /completeAiGeneration\("visual_memory"/);
});

test("concurrent identical requests allow only the atomic pending claim", () => {
  const jobs = new Map<string, Job>();
  const decisions = [claim(jobs, "same"), claim(jobs, "same")].map((item) => item.decision);
  assert.deepEqual(decisions, ["acquired", "pending"]);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /for update/);
});

test("rate-limited and globally busy requests return 429 with Retry-After", () => {
  assert.match(guard, /status: 429/);
  assert.match(guard, /"Retry-After"/);
  assert.match(migration, /decision', 'rate_limited'/);
  assert.match(migration, /decision', 'busy'/);
});

test("shared-network policy uses the revised per-IP allowances", () => {
  assert.match(guard, /letter: \{ windowSeconds: 600, ipLimit: 10, identityLimit: 2, ipDailyLimit: 30, identityDailyLimit: 6 \}/);
  assert.match(guard, /visual_memory: \{ windowSeconds: 600, ipLimit: 6, identityLimit: 0, ipDailyLimit: 15, identityDailyLimit: 0 \}/);
  assert.match(guard, /DEFAULT_AI_GLOBAL_CONCURRENCY = 8/);
  assert.match(guard, /AI_GENERATION_MAX_CONCURRENCY/);
});

test("OpenAI 429, timeout, and 500 cannot be amplified by SDK retries", () => {
  assert.equal(classifyAiUpstreamFailure({ status: 429 }), "rate_limited");
  assert.equal(classifyAiUpstreamFailure({ name: "APIConnectionTimeoutError" }), "timeout");
  assert.equal(classifyAiUpstreamFailure({ status: 500 }), "upstream");
  assert.match(guard, /OPENAI_CHAT_OPTIONS = \{ timeout: 45_000, maxRetries: 0 \}/);
  assert.match(guard, /OPENAI_IMAGE_OPTIONS = \{ timeout: 90_000, maxRetries: 0 \}/);
  for (const route of [letterRoute, visualRoute]) {
    assert.match(route, /OPENAI_CHAT_OPTIONS/);
    assert.match(route, /failAiGeneration/);
  }
  assert.match(visualRoute, /Please try again/);
  assert.match(letterRoute, /friendlyGenerateError/);
});

test("successful generation settles the job and failed generation permits a valid retry", () => {
  const jobs = new Map<string, Job>();
  assert.equal(claim(jobs, "retryable").decision, "acquired");
  jobs.set("retryable", { status: "failed" });
  assert.equal(claim(jobs, "retryable").decision, "acquired");
  assert.match(migration, /status = 'failed'/);
  assert.match(migration, /attempt_count = public\.ai_generation_jobs\.attempt_count \+ 1/);
  assert.match(letterRoute, /completeAiGeneration/);
  assert.match(visualRoute, /completeAiGeneration/);
});

test("frontends have synchronous submission guards without changing styling", () => {
  assert.match(letterClient, /letterSubmissionPendingRef\.current/);
  assert.match(visualClient, /generationPendingRef\.current/);
  assert.match(visualClient, /generationNonce/);
});

test("guard data is private and pseudonymized", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.ai_generation_jobs from public, anon, authenticated/);
  assert.match(guard, /createHmac\("sha256"/);
});
