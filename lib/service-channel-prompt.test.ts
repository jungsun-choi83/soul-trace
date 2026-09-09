import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { serviceChannelPromptBlock, withServiceChannelPrompt } from "./letter-voice.ts";
import { buildSurveyAnswers, type LetterTonePrefs } from "./survey.ts";

const tonePrefs: LetterTonePrefs = { mood: "warm", options: [], length: "normal" };
const en = JSON.parse(readFileSync(new URL("../locales/en.json", import.meta.url), "utf8"));

test("service channels add trusted context without replacing the base mode", () => {
  const pension = serviceChannelPromptBlock("pension");
  const grooming = serviceChannelPromptBlock("grooming");
  const hospital = serviceChannelPromptBlock("hospital");
  const funeral = serviceChannelPromptBlock("funeral");

  assert.ok(pension);
  assert.ok(grooming);
  assert.ok(hospital);
  assert.match(pension, /PENSION/);
  assert.match(pension, /living pet/);
  assert.match(pension, /Never suggest death/);
  assert.match(grooming, /GROOMING/);
  assert.match(grooming, /Never suggest death, loss, grief/);
  assert.match(hospital, /HOSPITAL/);
  assert.match(hospital, /Never invent a diagnosis/);
  assert.match(hospital, /recovery promise/);
  assert.equal(funeral, null);
});

test("legacy funeral channel leaves the normal memorial AI payload byte-for-byte unchanged", () => {
  const memorialPayload = "existing memorial user prompt";
  assert.equal(withServiceChannelPrompt(memorialPayload, null), memorialPayload);
  assert.equal(withServiceChannelPrompt(memorialPayload, "funeral"), memorialPayload);
  assert.notEqual(withServiceChannelPrompt(memorialPayload, "pension"), memorialPayload);
  assert.notEqual(withServiceChannelPrompt(memorialPayload, "grooming"), memorialPayload);
  assert.notEqual(withServiceChannelPrompt(memorialPayload, "hospital"), memorialPayload);
});

test("typed channel answers are included as facts, not prompt instructions", () => {
  const answers = buildSurveyAnswers(
    en,
    "living",
    ["only this answer", "", "", ""],
    tonePrefs,
    "Milo",
    "pension",
  );
  assert.equal(answers[0].id, "pension-1");
  assert.equal(answers[0].answer, "only this answer");
  assert.equal(answers[0].question, "What happened with your pet today?");
});
