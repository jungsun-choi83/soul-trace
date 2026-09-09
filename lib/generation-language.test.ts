import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  extractExplicitlyPreservedPhrases,
  generationCacheKey,
  hasUnexpectedLanguage,
  letterMatchesLocale,
} from "./generation-language.ts";

test("Korean questionnaire prose is rejected from an English letter", () => {
  assert.equal(hasUnexpectedLanguage("We remember 산책이 정말 행복했어요.", "en"), true);
  assert.equal(hasUnexpectedLanguage("We were happiest on our walks.", "en"), false);
});

test("English questionnaire prose is rejected from a Korean letter", () => {
  assert.equal(hasUnexpectedLanguage("함께 I loved our morning walks every day.", "ko"), true);
  assert.equal(hasUnexpectedLanguage("매일 아침 함께 걷던 시간이 참 좋았어.", "ko"), false);
});

test("names and explicitly quoted personal phrases may remain in another language", () => {
  const phrases = extractExplicitlyPreservedPhrases([
    'We always said “사랑해 콩이야”.',
    '우리만의 말은 "Good night my love"였어요.',
  ]);
  assert.deepEqual(phrases, ["사랑해 콩이야", "Good night my love"]);
  assert.equal(hasUnexpectedLanguage("I still call you 콩이.", "en", ["콩이"]), false);
  assert.equal(
    hasUnexpectedLanguage("마지막에는 Good night my love라고 말했어.", "ko", phrases),
    false,
  );
});

test("complete letter body and ending are checked in the selected locale", () => {
  assert.equal(
    letterMatchesLocale(
      { title: "A letter", paragraphs: ["I remember every walk."], endingPhrase: "언제나 곁에." },
      "en",
    ),
    false,
  );
});

test("generation identity differs by locale", () => {
  assert.notEqual(
    generationCacheKey("Person@Example.com", "living", "en"),
    generationCacheKey("Person@Example.com", "living", "ko"),
  );
});

test("locale switching regenerates on the server instead of translating in the browser", () => {
  const source = readFileSync("components/soul-trace-flow.tsx", "utf8");
  assert.match(source, /if \(lang === resultLocale\) return/);
  assert.match(source, /fetch\("\/api\/generate-letter"/);
  assert.match(source, /locale: lang/);
  assert.match(source, /skipImageGeneration: true/);
  assert.doesNotMatch(source, /translate(?:Letter|GeneratedLetter)\s*\(/);
});
