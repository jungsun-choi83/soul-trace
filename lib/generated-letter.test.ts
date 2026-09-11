import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  createGeneratedLetterStructure,
  ENDING_PHRASE_MARKER,
  isShortEndingPhrase,
  parseMarkedLetter,
} from "./generated-letter.ts";

describe("explicit generated letter structure", () => {
  it("keeps a long final body paragraph in the normal paragraphs array", () => {
    const finalParagraph =
      "This is a deliberately long final body paragraph containing the complete memory of our walk, the old path, the familiar gate, and the quiet moment afterward. It must remain ordinary body text regardless of its character count.";
    const structure = parseMarkedLetter(
      "A letter to Dad",
      `First complete paragraph.\n\n${finalParagraph}\n\n${ENDING_PHRASE_MARKER} Still sharing every little morning.`,
      "en",
    );

    assert.deepEqual(structure.paragraphs, ["First complete paragraph.", finalParagraph]);
    assert.equal(structure.endingPhrase, "Still sharing every little morning.");
  });

  it("styles only the explicit endingPhrase field", () => {
    const source = readFileSync("components/soul-trace-flow.tsx", "utf8");
    assert.doesNotMatch(source, /splitLetterSignature|findLastIndex|lines\.slice\(0, lastContentIndex\)/);
    assert.match(source, /data-letter-body/);
    assert.match(source, /data-letter-ending-phrase/);
    assert.match(
      source,
      /data-letter-ending-phrase[\s\S]{0,800}font-semibold italic[\s\S]{0,800}activeLetterStructure\.endingPhrase/,
    );
  });

  it("accepts only short single-line English and Korean endings", () => {
    assert.equal(isShortEndingPhrase("Always near your favorite window.", "en"), true);
    assert.equal(isShortEndingPhrase("언제나 네 곁에 있을게.", "ko"), true);
    assert.equal(isShortEndingPhrase("Too short", "en"), false);
    assert.equal(
      isShortEndingPhrase("This ending contains far too many words to fit the explicit field safely.", "en"),
      false,
    );
    assert.equal(isShortEndingPhrase("Always near\nacross two lines", "en"), false);
    assert.equal(isShortEndingPhrase("첫 줄\n둘째 줄", "ko"), false);
  });

  it("never uses body length to select ending text", () => {
    const shortBody = createGeneratedLetterStructure(
      "A letter",
      "Short body.",
      "Holding onto this small joy.",
      "en",
    );
    const longBody = createGeneratedLetterStructure(
      "A letter",
      "Long body sentence. ".repeat(500),
      "Holding onto this small joy.",
      "en",
    );
    const noExplicitEnding = parseMarkedLetter(
      "A letter",
      "Body paragraph.\n\nA very long final paragraph stays here. ".repeat(100),
      "en",
    );

    assert.equal(shortBody.endingPhrase, longBody.endingPhrase);
    assert.equal(noExplicitEnding.endingPhrase, "");
    assert.ok(noExplicitEnding.paragraphs.at(-1)?.includes("A very long final paragraph"));
  });
});
