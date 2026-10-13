import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSeasonalPolaroidMemoMessages,
  fallbackSeasonalPolaroidMemo,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidPromptAnswers,
} from "./seasonal-polaroid-prompts.ts";

const ANSWERS: SeasonalPolaroidPromptAnswers = {
  themeId: "halloween",
  locale: "en",
  petName: "Tuli",
  species: "cat",
  status: "living",
  costume: "pumpkin",
  scene: "pumpkin-patch",
  vibe: "cute-cozy",
  personalities: ["foodie"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
  personalDetail: "Waits by the window.",
};

test("fallback memo is four short first-person lines", () => {
  const memo = fallbackSeasonalPolaroidMemo(ANSWERS);
  assert.equal(memo.lines.length, 4);
  assert.match(memo.lines[0]!, /Mom/);
  assert.match(memo.lines[0]!, /Tuli/);
  assert.ok(memo.lines.slice(1).every((line) => !line.includes("Tuli")));
  assert.ok(memo.lines.every((line) => line.length <= 96));
});

test("memo prompt carries questionnaire data and first-person rules", () => {
  const messages = buildSeasonalPolaroidMemoMessages(ANSWERS);
  assert.match(messages[0]!.content, /first-person/i);
  const payload = JSON.parse(messages[1]!.content) as { data: Record<string, unknown> };
  assert.equal(payload.data.petName, "Tuli");
  assert.equal(payload.data.ownerCallName, "Mom");
  assert.equal(payload.data.favoriteTreat, "tuna");
  assert.equal(payload.data.personalDetail, "Waits by the window.");
});

test("memo validation rejects the former third-person template", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Tuli!",
      "Tuli is dressed in a pumpkin costume.",
      "I can almost see Tuli napping in the sun.",
      "Wishing you a cozy Halloween.",
    ],
  }, ANSWERS);
  assert.deepEqual(result, { valid: false, reason: "memo_third_person" });
});
