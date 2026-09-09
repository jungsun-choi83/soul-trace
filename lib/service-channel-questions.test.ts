import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSurveyAnswers,
  channelMemoryQuestions,
  isChannelMemoryOptional,
  isSurveyComplete,
  memoryQuestionCount,
  type LetterTonePrefs,
} from "./survey.ts";
import { parseServiceChannel } from "./service-channel.ts";

const en = JSON.parse(readFileSync(new URL("../locales/en.json", import.meta.url), "utf8"));
const ko = JSON.parse(readFileSync(new URL("../locales/ko.json", import.meta.url), "utf8"));
const tonePrefs: LetterTonePrefs = { mood: "calm", options: [], length: "normal" };

test("each channel exposes its requested free-text questions", () => {
  const expected = {
    pension: [
      "What happened with your pet today?",
      "How was your pet feeling today?",
      "What did your pet enjoy most?",
      "Was there a cute or funny moment today?",
    ],
    grooming: [
      "What grooming service did your pet receive today?",
      "What is the biggest before-and-after change?",
      "How did your pet react after grooming?",
      "What looks especially cute today?",
      "Did the groomer notice a funny or lovely detail?",
    ],
    hospital: [
      "What kind of visit did your pet have today?",
      "How did your pet behave during the visit?",
      "Was there a comforting or cute moment?",
      "Is there a confirmed care update you would like to mention?",
    ],
  } as const;

  for (const [name, prompts] of Object.entries(expected)) {
    const channel = parseServiceChannel(name)!;
    const questions = channelMemoryQuestions(en, channel);
    assert.ok(questions);
    assert.deepEqual(questions.map((item) => item.promptText), prompts);
    assert.equal(memoryQuestionCount(channel), prompts.length);
  }
});

test("channel questions have no predefined answer choices and optional fields stay optional", () => {
  for (const channel of ["pension", "grooming", "hospital"] as const) {
    const questions = channelMemoryQuestions(en, channel)!;
    assert.ok(questions.every((question) => !("options" in question)));
    assert.deepEqual(
      questions.map((question, index) => isChannelMemoryOptional(channel, index)),
      questions.map((question) => question.optional === true),
    );
  }
});

test("required channel answers use existing completion validation", () => {
  assert.equal(isSurveyComplete(["one", "two", "three", ""], tonePrefs, "pension"), true);
  assert.equal(isSurveyComplete(["one", "", "three", "four"], tonePrefs, "pension"), false);
  assert.equal(isSurveyComplete(["one", "two", "three", "four", ""], tonePrefs, "grooming"), true);
});

test("no channel keeps the existing five-question flow and typed answers survive locale changes", () => {
  assert.equal(memoryQuestionCount(null), 5);
  const answers = buildSurveyAnswers(en, "living", ["typed answer", "", "", "", ""], tonePrefs, "Milo");
  const switched = buildSurveyAnswers(ko, "living", ["typed answer", "", "", "", ""], tonePrefs, "Milo");
  assert.equal(answers[0].answer, "typed answer");
  assert.equal(switched[0].answer, "typed answer");
  assert.equal(channelMemoryQuestions(en, null), null);
  assert.equal(channelMemoryQuestions(ko, null), null);
});

test("legacy funeral channel uses the exact normal memorial questionnaire in both locales", () => {
  const memoryAnswers = ["one", "two", "three", "four", ""];
  for (const messages of [en, ko]) {
    const normal = buildSurveyAnswers(
      messages,
      "memorial",
      memoryAnswers,
      tonePrefs,
      "Milo",
    );
    const legacyFuneral = buildSurveyAnswers(
      messages,
      "memorial",
      memoryAnswers,
      tonePrefs,
      "Milo",
      "funeral",
    );
    assert.deepEqual(legacyFuneral, normal);
    assert.deepEqual(
      legacyFuneral.map((answer) => answer.id),
      normal.map((answer) => answer.id),
    );
  }
  assert.equal(channelMemoryQuestions(en, "funeral"), null);
  assert.equal(channelMemoryQuestions(ko, "funeral"), null);
  assert.equal(memoryQuestionCount("funeral"), memoryQuestionCount(null));
  assert.equal(isSurveyComplete(memoryAnswers, tonePrefs, "funeral"), true);
  assert.equal(isSurveyComplete(memoryAnswers, tonePrefs, null), true);
});

test("Korean locale contains every channel question without English fallback", () => {
  for (const channel of ["pension", "grooming", "hospital"] as const) {
    const english = channelMemoryQuestions(en, channel)!;
    const korean = channelMemoryQuestions(ko, channel)!;
    assert.equal(korean.length, english.length);
    assert.ok(korean.every((item) => item.promptText.trim().length > 0));
    assert.ok(korean.every((item, index) => item.promptText !== english[index].promptText));
  }
});
