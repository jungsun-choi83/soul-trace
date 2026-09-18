import assert from "node:assert/strict";
import test from "node:test";

import { formatLetterCreationDate, letterSignatureName } from "./letter-signature.ts";

const createdAt = "2026-09-18T03:00:00.000Z";

test("formats the saved creation date in Korean", () => {
  assert.equal(formatLetterCreationDate(createdAt, "ko"), "2026년 9월 18일");
});

test("formats the saved creation date in English", () => {
  assert.equal(formatLetterCreationDate(createdAt, "en"), "September 18, 2026");
});

test("keeps the saved pet name unchanged and never invents a signature", () => {
  assert.equal(letterSignatureName("비비"), "비비");
  assert.equal(letterSignatureName("Bibi"), "Bibi");
  assert.equal(letterSignatureName(""), "");
  assert.equal(letterSignatureName(undefined), "");
});
