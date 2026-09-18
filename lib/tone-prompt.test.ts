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
    assert.match(toneBlock("en", "bright", "short"), /lively, conversational rhythm/);
    assert.match(toneBlock("en", "calm", "short"), /restrained, quiet phrasing/);
    assert.match(toneBlock("en", "warm", "short"), /gentle, reassuring wording/);
    assert.match(toneBlock("ko", "bright", "short"), /경쾌한 리듬/);
    assert.match(toneBlock("ko", "calm", "short"), /안정적인 호흡/);
    assert.match(toneBlock("ko", "warm", "short"), /부드럽고 따뜻한 어휘/);
  });

  it("short and normal length behavior remains unchanged", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const mood of moods) {
        const short = toneBlock(locale, mood, "short");
        const normal = toneBlock(locale, mood, "normal");
        if (locale === "en") {
          assert.match(short, /Keep the letter naturally short/);
          assert.match(normal, /Use a natural length shaped by the available memories/);
        } else {
          assert.match(short, /편지는 짧고 자연스럽게 쓴다/);
          assert.match(normal, /편지는 기억의 양과 감정 흐름에 맞는 자연스러운 길이로 쓴다/);
        }
      }
    }
  });
});
