import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isStampType, resolveDefaultStampByPetType, resolveStampType } from "./stamp.ts";

test("uploaded stamp photos always take priority", () => {
  assert.equal(resolveStampType("cat", true), "photo");
});

test("skipped photos use the selected pet type fallback", () => {
  assert.equal(resolveStampType("dog", false), "paw_dog");
  assert.equal(resolveStampType("cat", false), "paw_cat");
  assert.equal(resolveStampType("rabbit", false), "paw_rabbit");
  assert.equal(resolveStampType("hamster", false), "paw_hamster");
  assert.equal(resolveStampType("bird", false), "paw_bird");
  assert.equal(resolveStampType("other", false), "paw_other");
});

test("missing or unsupported pet types use the neutral fallback", () => {
  assert.equal(resolveDefaultStampByPetType("unicorn"), "other");
  assert.equal(resolveDefaultStampByPetType(undefined), "other");
  assert.equal(resolveStampType("unknown", false), "paw_other");
});

test("persisted stamp type values are recognized safely", () => {
  for (const value of ["photo", "paw_dog", "paw_cat", "paw_rabbit", "paw_hamster", "paw_bird", "paw_other"]) {
    assert.equal(isStampType(value), true);
  }
  assert.equal(isStampType("paw"), true);
});

test("the letter renderer uses supplied PNG artwork without the old paw distortion filter", () => {
  const renderer = readFileSync(new URL("../components/letter-postage-stamp.tsx", import.meta.url), "utf8");
  assert.match(renderer, /\/images\/stamps\/\$\{defaultStamp\}\.png/);
  assert.doesNotMatch(renderer, /\/images\/stamps\/\$\{defaultStamp\}\.svg/);
  assert.doesNotMatch(renderer, /pawInkId/);
});
