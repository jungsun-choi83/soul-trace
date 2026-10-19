import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearLetterExperienceSession } from "./letter-experience-session.ts";

test("starting a Letter clears only the active mode and channel session", () => {
  const removed: string[] = [];
  clearLetterExperienceSession({ removeItem: (key) => removed.push(key) }, "living", "pension");

  assert.deepEqual(removed, [
    "soul-trace-draft:v1:living:pension",
    "soul-trace-result:v1:living:pension",
    "soul-trace-pending-generation:living:pension",
  ]);
});

test("direct Letter starts use the direct context without touching Polaroid storage", () => {
  const removed: string[] = [];
  clearLetterExperienceSession({ removeItem: (key) => removed.push(key) }, "memorial", null);

  assert.deepEqual(removed, [
    "soul-trace-draft:v1:memorial:direct",
    "soul-trace-result:v1:memorial:direct",
    "soul-trace-pending-generation:memorial:default",
  ]);
  assert.doesNotMatch(removed.join("\n"), /polaroid/i);
});

test("only Letter cards reset the session before navigation", () => {
  const choice = readFileSync("components/mode-choice.tsx", "utf8");
  assert.match(choice, /onClick=\{\(\) => startLetter\("living"\)\}/);
  assert.match(choice, /onClick=\{\(\) => startLetter\("memorial"\)\}/);
  assert.match(choice, /kind="polaroid"[\s\S]*?seasonal/);
  assert.doesNotMatch(choice, /kind="polaroid"[\s\S]*?onClick=\{\(\) => startLetter/);
});
