import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  completedResultKey,
  parseCompletedResult,
  type CompletedResultSession,
} from "./completed-result-session.ts";

const completed: CompletedResultSession = {
  version: 1,
  mode: "living",
  channel: "pension",
  resultLocale: "en",
  petIntro: { petName: "Coco", petNickname: "", petType: "dog", petBreed: "Poodle", petAge: "5", yearMet: "", yearParted: "2026", letterRecipient: "mom", letterRecipientDetail: "" },
  memoryAnswers: ["waits near the door", "loves walks"],
  result: { personalityType: "Gentle Soul", personalitySummary: "Warm and loyal", personalityTags: ["warm"], letter: "Dear Mom,\nI still remember...", letterStructure: { title: "Dear Mom", paragraphs: ["I still remember..."], endingPhrase: "Always your Coco" }, heroImageUrl: "https://example.com/hero.jpg", letterId: "letter-1", generationLocale: "en" },
};

test("completed result keys isolate mode and canonical channel", () => {
  assert.equal(completedResultKey("living", "pension"), "soul-trace-result:v1:living:pension");
  assert.equal(completedResultKey("living", "grooming"), "soul-trace-result:v1:living:grooming");
  assert.equal(completedResultKey("memorial", null), "soul-trace-result:v1:memorial:direct");
});

test("exact generated content and presentation metadata survive serialization", () => {
  assert.deepEqual(parseCompletedResult(JSON.stringify(completed), "living", "pension"), completed);
});

test("completed results never cross channel or mode boundaries", () => {
  const serialized = JSON.stringify(completed);
  assert.equal(parseCompletedResult(serialized, "living", "grooming"), null);
  assert.equal(parseCompletedResult(serialized, "memorial", null), null);
});

test("invalid, empty, and unsupported completed results are rejected", () => {
  assert.equal(parseCompletedResult("bad json", "living", "pension"), null);
  assert.equal(parseCompletedResult(JSON.stringify({ ...completed, version: 2 }), "living", "pension"), null);
  assert.equal(parseCompletedResult(JSON.stringify({ ...completed, result: { ...completed.result, letter: "" } }), "living", "pension"), null);
});

test("flow restores session result before questionnaire and never regenerates it", () => {
  const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
  assert.match(flow, /window\.sessionStorage\.getItem\(resultStorageKey\)/);
  assert.match(flow, /setResult\(completed\.result\)/);
  assert.match(flow, /const isRestoredResult = initialResult != null \|\| result != null/);
  assert.match(flow, /persistCompletedResult/);
});
