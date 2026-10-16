import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");

test("production worker explicitly routes all three generation kinds", () => {
  assert.match(worker, /case "letter":\s+[\s\S]*?await processLetterJob\(job, baseUrl\);/);
  assert.match(worker, /case "visual_memory":\s+[\s\S]*?await processVisualMemoryJob\(job, baseUrl\);/);
  assert.match(worker, /case "seasonal_polaroid":\s+[\s\S]*?await processSeasonalPolaroidJob\(job\);/);
  assert.match(worker, /unsupported_generation_kind/);
  assert.doesNotMatch(worker, /else\s*\{\s*await processVisualMemoryJob/);
});

test("Seasonal worker dependencies are server-side and reservation-aware", () => {
  assert.match(worker, /seasonal-polaroid-ai/);
  assert.match(worker, /seasonal-polaroid-admission/);
  assert.match(worker, /seasonal-polaroid-result-storage/);
  assert.match(worker, /seasonal-polaroid-guest-trial/);
  assert.match(worker, /guestTrialReservationVersion/);
  assert.match(worker, /finalizeSeasonalGuestTrial/);
  assert.match(worker, /releaseSeasonalGuestTrial/);
  assert.match(guard, /"seasonal_polaroid"/);
});

test("legacy worker behavior remains on the existing queue and API paths", () => {
  assert.match(worker, /claimAiGenerationJobs\(\)/);
  assert.match(worker, /requeueAiGenerationJob/);
  assert.match(worker, /api\/generate-letter/);
  assert.match(worker, /api\/visual-memory/);
  assert.match(worker, /x-soul-trace-ai-worker-token/);
});
