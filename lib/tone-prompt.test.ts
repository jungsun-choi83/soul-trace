import assert from "node:assert/strict";
import { describe, it } from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Messages } from "./i18n.ts";
import { buildTonePromptBlock, type LetterLength, type LetterToneMood } from "./survey.ts";

const messages = { en: en as unknown as Messages, ko: ko as unknown as Messages };
const moods: LetterToneMood[] = ["bright", "calm", "warm"];

function toneBlock(locale: "en" | "ko", mood: LetterToneMood, length: LetterLength) {
  return buildTonePromptBlock(locale, { mood, length, options: [] }, messages[locale], "living");
}

describe("explicit letter tone profiles", () => {
  it("bright, calm, and warm produce different style guidance", () => {
    for (const locale of ["en", "ko"] as const) {
      const blocks = moods.map((mood) => toneBlock(locale, mood, "short"));
      assert.equal(new Set(blocks).size, moods.length);
    }
  });

  it("every mood preserves factual grounding", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const mood of moods) {
        const block = toneBlock(locale, mood, "short");
        assert.match(
          block,
          locale === "en"
            ? /never change WHAT happened/
            : /실제로 일어난 내용은 절대 바꾸지 마/,
        );
      }
    }
  });

  it("English and Korean receive their own natural-language guidance", () => {
    assert.match(toneBlock("en", "bright", "short"), /Playful, affectionate/);
    assert.match(toneBlock("en", "calm", "short"), /Calm, affectionate/);
    assert.match(toneBlock("en", "warm", "short"), /Warm and loving/);
    assert.match(toneBlock("ko", "bright", "short"), /밝고 장난스럽고 다정한/);
    assert.match(toneBlock("ko", "calm", "short"), /담담하고 다정한/);
    assert.match(toneBlock("ko", "warm", "short"), /따뜻하고 사랑스러운/);
  });

  it("memorial tone guidance is not the living playful profile", () => {
    const living = buildTonePromptBlock("ko", { mood: "bright", length: "short", options: [] }, messages.ko, "living");
    const memorial = buildTonePromptBlock("ko", { mood: "bright", length: "short", options: [] }, messages.ko, "memorial");
    assert.match(living, /밝고 장난스럽고 다정한/);
    assert.match(memorial, /그 아이답고 자연스러운/);
    assert.notEqual(living, memorial);
  });

  it("short and normal length behavior remains unchanged", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const mood of moods) {
        const short = toneBlock(locale, mood, "short");
        const normal = toneBlock(locale, mood, "normal");
        if (locale === "en") {
          assert.match(short, /about 9-12 visually readable lines/);
          assert.match(normal, /about 15-20 visually readable lines/);
        } else {
          assert.match(short, /대략 9~12줄/);
          assert.match(normal, /대략 15~20줄/);
        }
      }
    }
  });
});
