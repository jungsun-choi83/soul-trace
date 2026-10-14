import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeasonalPolaroidMemoMessages, type SeasonalPolaroidPromptAnswers } from "./seasonal-polaroid-prompts.ts";

const generator = readFileSync(resolve(process.cwd(), "lib/seasonal-polaroid-ai.ts"), "utf8");

test("memo generation retries once and falls back after bounded model failures", () => {
  assert.match(generator, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(generator, /catch \(error\)/);
  assert.match(generator, /fallbackSeasonalPolaroidMemo\(answers\)/);
  assert.match(generator, /retried: true/);
});

test("memo generation uses structured JSON and validates the requested locale", () => {
  assert.match(generator, /response_format: \{ type: "json_object" \}/);
  assert.match(generator, /validateSeasonalPolaroidMemo\(parsed, answers\)/);
  assert.match(generator, /buildSeasonalPolaroidMemoMessages\(answers\)/);
  assert.match(generator, /model: "gpt-4o-mini"/);
});

const ANSWERS: SeasonalPolaroidPromptAnswers = {
  themeId: "halloween",
  locale: "en",
  petName: "Mochi",
  species: "cat",
  status: "living",
  costume: "pumpkin",
  scene: "pumpkin-patch",
  vibe: "cute-cozy",
  personalities: ["foodie", "cuddle-bug"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
  personalDetail: "Waits by the window.",
};

test("memo request sends the full questionnaire to the AI", () => {
  const messages = buildSeasonalPolaroidMemoMessages(ANSWERS);
  const userMessage = JSON.parse(messages[1]!.content) as { data: Record<string, unknown> };
  assert.equal(messages[0]!.role, "system");
  assert.equal(messages[1]!.role, "user");
  assert.equal(userMessage.data.petName, "Mochi");
  assert.equal(userMessage.data.ownerCallName, "Mom");
  assert.equal(userMessage.data.habit, "napping in every sunbeam");
  assert.equal(userMessage.data.personalDetail, "Waits by the window.");
  assert.deepEqual(userMessage.data.personalities, ["a love of snacks", "a deep love of cuddles"]);
});
