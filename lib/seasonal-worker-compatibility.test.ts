import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");

test("worker dispatches all supported generation kinds explicitly", () => {
  assert.match(worker, /case "letter":\s*await processLetterJob/);
  assert.match(worker, /case "visual_memory":\s*await processVisualMemoryJob/);
  assert.match(worker, /case "seasonal_polaroid":\s*await processSeasonalPolaroidJob/);
  assert.match(worker, /unsupported_generation_kind/);
});

test("Seasonal worker uses the shared queue and reservation-aware completion", () => {
  assert.match(guard, /"seasonal_polaroid"/);
  assert.match(worker, /claimAiGenerationJobs\(\)/);
  assert.match(worker, /completeSeasonalPolaroidJob\(job\.request_hash, result\)/);
  assert.match(worker, /finalizeSeasonalGuestTrial/);
  assert.match(worker, /releaseSeasonalGuestTrial/);
});

test("existing Letter and Visual Memory processors remain present", () => {
  assert.match(worker, /async function processLetterJob/);
  assert.match(worker, /async function processVisualMemoryJob/);
  assert.match(worker, /\/api\/generate-letter/);
  assert.match(worker, /\/api\/visual-memory/);
});

test("Seasonal worker generates the image first and writes the caption from it", () => {
  const imageStep = worker.indexOf("generateSeasonalPolaroidImage({");
  const memoStep = worker.indexOf("generateSeasonalPolaroidMemo({");
  assert.ok(imageStep > 0 && memoStep > imageStep, "caption must be requested after the image exists");
  assert.match(worker, /image: \{ base64: Buffer\.from\(imageBytes\)\.toString\("base64"\), mimeType: "image\/jpeg" \}/);
  assert.match(worker, /downloadSeasonalPolaroidResultImage\(\{ storage, objectKey: resultPath \}\)/);
  assert.doesNotMatch(worker, /memoPromise/);
  assert.match(worker, /memoVision: memoResult\.vision/);
  assert.match(worker, /memoAttempts: memoResult\.attempts/);
  assert.match(worker, /memoFirstAttemptValid: memoResult\.firstAttemptValid/);
  assert.match(worker, /memoFailureCodes: memoResult\.failureCodes/);
});
