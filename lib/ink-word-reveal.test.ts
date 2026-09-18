import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  bufferedWordDelayMs,
  buildInkRevealPlan,
  completeStreamedLetterPrefix,
  MAX_INK_REVEAL_DURATION_MS,
  revealUnits,
  shouldStartBufferedReveal,
} from "./ink-word-reveal.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const component = readFileSync("components/ink-word-reveal.tsx", "utf8");
const css = readFileSync("components/ink-word-reveal.module.css", "utf8");

function visibleText(plan: ReturnType<typeof buildInkRevealPlan>): string[] {
  return plan.map((section) => section.map((token) => token.text).join(""));
}

test("English and Korean text is preserved exactly while revealing whole words", () => {
  const english = "Dear Mina,\n\nI still remember everything.";
  const korean = "사랑하는 미나에게, 오늘도 네 생각이 났어.";
  const plan = buildInkRevealPlan([english, korean]);
  assert.deepEqual(visibleText(plan), [english, korean]);
  assert.deepEqual(
    plan[1].filter((token) => token.isWord).map((token) => token.text),
    ["사랑하는", "미나에게,", "오늘도", "네", "생각이", "났어."],
  );
  assert.ok(plan[1].filter((token) => token.isWord).length < Array.from(korean.replace(/\s/gu, "")).length);
});

test("timing is deterministic, punctuation-aware, and capped for long letters", () => {
  const sample = ["Dear Mina, I remember. Always!"];
  assert.deepEqual(buildInkRevealPlan(sample), buildInkRevealPlan(sample));
  const words = buildInkRevealPlan(sample)[0].filter((token) => token.isWord);
  assert.ok(words[2].delayMs - words[1].delayMs > words[1].delayMs - words[0].delayMs);

  const longPlan = buildInkRevealPlan([Array.from({ length: 500 }, (_, i) => `word${i}`).join(" ")]);
  const last = longPlan[0].filter((token) => token.isWord).at(-1)!;
  assert.ok(last.delayMs + last.durationMs <= MAX_INK_REVEAL_DURATION_MS + 100);
});

test("the finished layout is present before opacity and clip reveal", () => {
  assert.match(css, /display: inline-block/);
  assert.match(css, /opacity: 0/);
  assert.match(css, /clip-path: inset\(0 100% 0 0\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /translate|cursor|blink|bounce/i);
  assert.match(component, /token\.text/);
});

test("buffered streaming exposes only complete ordered words", () => {
  assert.equal(completeStreamedLetterPrefix("Dear Mi"), "Dear ");
  assert.equal(completeStreamedLetterPrefix("Dear Mina, I "), "Dear Mina, I ");
  assert.equal(completeStreamedLetterPrefix("Dear Mina [[ENDING_PH"), "Dear Mina ");
  assert.deepEqual(revealUnits("Dear Mina,\n\nI remember. "), ["Dear ", "Mina,\n\n", "I ", "remember. "]);
  assert.equal(shouldStartBufferedReveal("one two three four five six seven eight nine ", false), false);
  assert.equal(shouldStartBufferedReveal("one two three four five six seven eight nine ten ", false), true);
  assert.equal(shouldStartBufferedReveal("Dear Mina. ", false), false);
  assert.equal(shouldStartBufferedReveal("Dear Mina, I remember. ", false), true);
  assert.equal(bufferedWordDelayMs("Mina,", 1, 20), bufferedWordDelayMs("Mina,", 1, 20));
});

test("SSE stays internal while buffered words animate before completion", () => {
  assert.match(flow, /onLetterDelta/);
  assert.match(flow, /useBufferedInkReveal/);
  assert.match(flow, /streamedText: isLoading \? result\?\.letter/);
  assert.match(flow, /const \[animateFreshLetter, setAnimateFreshLetter\] = useState\(false\)/);
  assert.match(flow, /setAnimateFreshLetter\(true\)[\s\S]*?setResult\(\{/);
  assert.match(flow, /persistCompletedResult\(completedResult\)[\s\S]*?setResult\(completedResult\)/);
  assert.match(flow, /const animateLetterWords = animateFreshLetter/);
});
