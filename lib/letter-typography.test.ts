import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const fonts = readFileSync("components/generated-letter-fonts.ts", "utf8");

test("generated letters use scoped handwritten fonts by language", () => {
  assert.match(fonts, /Caveat/);
  assert.match(fonts, /Allura/);
  assert.match(fonts, /UnPen\.ttf/);
  assert.match(flow, /data-letter-salutation/);
  assert.match(flow, /--font-letter-en-opening/);
  assert.match(flow, /--font-letter-en-body/);
  assert.match(flow, /--font-letter-ko/);
  assert.match(flow, /break-words/);
});

test("the bundled UnPen asset is a real TrueType font", () => {
  const path = "public/fonts/UnPen.ttf";
  const signature = readFileSync(path).subarray(0, 4);
  assert.deepEqual([...signature], [0, 1, 0, 0]);
  assert.ok(statSync(path).size > 1_000_000);
});
