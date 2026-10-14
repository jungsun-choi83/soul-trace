import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonts = readFileSync("components/generated-letter-fonts.ts", "utf8");

test("living and memorial Korean letter stacks stay distinct", () => {
  assert.match(
    fonts,
    /LIVING_KOREAN_LETTER_STACK =\s*"var\(--font-letter-ko-living\), 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"/,
  );
  assert.match(fonts, /MEMORIAL_KOREAN_LETTER_STACK =[\s\S]*nanum-myeongjo/);
});
