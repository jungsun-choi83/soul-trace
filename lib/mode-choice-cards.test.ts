import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };

const component = readFileSync("components/mode-choice.tsx", "utf8");
const page = readFileSync("app/choose/page.tsx", "utf8");
const styles = readFileSync("components/mode-choice.module.css", "utf8");

test("mode choices use separate local photographic cards with unchanged copy", () => {
  assert.ok(existsSync("public/images/choice-living.jpg"));
  assert.ok(existsSync("public/images/choice-memorial.jpg"));
  assert.match(component, /\/images\/choice-living\.jpg/);
  assert.match(component, /\/images\/choice-memorial\.jpg/);
  assert.doesNotMatch(component, /Soul_Trace_Photo_Cards_Preview/);
  assert.equal(en.modes.living.landingCta, "A companion still beside me");
  assert.equal(en.modes.living.landingHint, "Hear how today went—from their side of the room.");
  assert.equal(en.modes.memorial.landingCta, "A companion who crossed the rainbow bridge");
  assert.equal(en.modes.memorial.landingHint, "There are still words they never got to say.");
  assert.ok(ko.modes.living.landingCta.length > 0);
  assert.ok(ko.modes.memorial.landingCta.length > 0);
});

test("complete cards keep the existing living and memorial destinations", () => {
  assert.match(component, /LETTER_MODES\.map/);
  assert.match(component, /const path = letterModePath\(mode\)/);
  assert.match(component, /href=\{hrefFor\(mode\)\}/);
});

test("offers a subtle localized Life Archive link after the cards", () => {
  assert.match(component, /archiveParams\.set\("from", "choose"\)/);
  assert.match(component, /href=\{archiveHref\}/);
  assert.match(component, /t\("lifeArchive\.title"\)/);
  assert.match(component, /mt-5 flex justify-end/);
  assert.match(component, /min-h-\[100svh\] overflow-x-hidden/);
  assert.doesNotMatch(component, /h-\[100svh\] overflow-hidden/);
  assert.equal(en.lifeArchive.title, "Life Archive");
  assert.equal(ko.lifeArchive.title, "삶의 기록");
});

test("back and card destinations preserve validated query parameters", () => {
  assert.match(page, /Object\.entries\(params\)/);
  assert.match(page, /preservedParams\.append\(key, item\)/);
  assert.match(page, /preservedParams\.append\(key, value\)/);
  assert.match(page, /preservedParams\.set\(PARTNER_CODE_PARAM, code\)/);
  assert.match(component, /href=\{`\/\$\{querySuffix\}`\}/);
  assert.match(component, /return `\$\{path\}\$\{querySuffix\}`/);
});

test("cards have responsive, accessible, reduced-motion presentation", () => {
  assert.match(component, /min-h-\[100svh\] overflow-x-hidden/);
  assert.match(component, /max-w-\[460px\]/);
  assert.match(component, /aspect-\[1\.65\/1\]/);
  assert.doesNotMatch(component, /sm:grid-cols-2/);
  assert.match(component, /rounded-\[18px\]/);
  assert.match(component, /focus-visible:outline-2/);
  assert.match(component, /object-cover object-center/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
