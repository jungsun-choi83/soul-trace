import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { HALLOWEEN_POLAROID_THEME } from "./seasonal-polaroid.ts";

const component = readFileSync("components/polaroid-entry.tsx", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8")) as Record<string, unknown>;
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8")) as Record<string, unknown>;
const at = (tree: Record<string, unknown>, path: string) => path.split(".").reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), tree);

test("the photo step has exactly one upload slot and sends only that photo", () => {
  assert.equal((component.match(/<PhotoSlotView\b/g) ?? []).length, 1);
  assert.equal((component.match(/type="file"/g) ?? []).length, 1);
  assert.match(component, /buildSeasonalPolaroidFormData\(questionnaire, primaryPhoto\.file\)/);
  assert.doesNotMatch(component, /secondPhoto|secondInputRef|PhotoSlot\b|screen2\.secondLabel/);
  for (const locale of [en, ko]) {
    assert.equal(at(locale, "seasonalPolaroid.flow.screen2.secondLabel"), undefined);
    assert.equal(typeof at(locale, "seasonalPolaroid.flow.screen2.primaryLabel"), "string");
    for (const key of ["intro", "introPassed"]) assert.doesNotMatch(String(at(locale, `seasonalPolaroid.flow.screen2.${key}`)), /second|한 장 더/i);
  }
});

test("'What does your pet call you?' no longer offers 'Something else', and 'A name' still takes a typed name", () => {
  assert.deepEqual(HALLOWEEN_POLAROID_THEME.callNames.map((option) => option.id), ["mom", "dad", "both", "sister", "brother", "by-name"]);
  for (const locale of [en, ko]) {
    const labels = at(locale, "seasonalPolaroid.flow.options.callNames") as Record<string, string>;
    assert.equal(labels.custom, undefined);
    assert.equal(typeof labels.byName, "string");
  }
  assert.doesNotMatch(component, /\["by-name", "custom"\]/);
  assert.match(component, /answers\.callName === "by-name" && !answers\.customCallName\.trim\(\)/);
  assert.match(component, /answers\.callName === "by-name" \? <input/);
  // A draft saved while "Something else" existed restores as "A name" with the same typed name.
  assert.match(component, /draft\.callName === "custom" \? "by-name" : draft\.callName/);
});
