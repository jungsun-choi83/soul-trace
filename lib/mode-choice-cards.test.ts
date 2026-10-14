import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };

const component = readFileSync("components/mode-choice.tsx", "utf8");
const page = readFileSync("app/choose/page.tsx", "utf8");
const styles = readFileSync("components/mode-choice.module.css", "utf8");

test("mode choices use the three localized photographic cards", () => {
  assert.ok(existsSync("public/images/choice-living.jpg"));
  assert.ok(existsSync("public/images/choice-memorial.jpg"));
  assert.ok(existsSync("public/images/Cozy Halloween Night Polaroid.png"));
  assert.match(component, /\/images\/choice-living\.jpg/);
  assert.match(component, /\/images\/choice-memorial\.jpg/);
  assert.match(component, /\/images\/Cozy Halloween Night Polaroid\.png/);
  assert.doesNotMatch(component, /Soul_Trace_Photo_Cards_Preview/);
  assert.equal(en.modes.living.landingCta, "A companion still beside me");
  assert.equal(en.modes.memorial.landingCta, "A companion who crossed the rainbow bridge");
  assert.equal(en.landing.livingTitle, "Still By My Side");
  assert.equal(en.landing.memorialTitle, "Forever In My Heart");
  assert.equal(en.landing.polaroidTitle, "A Moment to Keep");
  assert.ok(en.landing.subtitle.includes("Every bond"));
  assert.ok(ko.landing.livingTitle.length > 0);
  assert.ok(ko.landing.memorialTitle.length > 0);
  assert.ok(ko.landing.polaroidTitle.length > 0);
});

test("all three cards keep their existing destinations", () => {
  assert.match(component, /hrefFor\("living"\)/);
  assert.match(component, /hrefFor\("memorial"\)/);
  assert.match(component, /href=\{polaroidHref\}/);
  assert.match(component, /letterModePath\(mode\)/);
  assert.match(component, /const polaroidHref = `\/polaroid\$\{querySuffix\}`/);
});

test("back and card destinations preserve validated query parameters", () => {
  assert.match(page, /Object\.entries\(params\)/);
  assert.match(page, /preservedParams\.append\(key, item\)/);
  assert.match(page, /preservedParams\.append\(key, value\)/);
  assert.match(page, /preservedParams\.set\(PARTNER_CODE_PARAM, code\)/);
  assert.match(component, /href=\{`\/\$\{querySuffix\}`\}/);
  assert.match(component, /new URLSearchParams\(preservedQuery\)/);
});

test("cards have responsive, accessible, reduced-motion presentation", () => {
  assert.match(component, /min-h-\[100svh\] overflow-x-hidden/);
  assert.match(component, /styles\.choiceGrid/);
  assert.match(component, /styles\.card/);
  assert.match(component, /styles\.brandRule/);
  assert.match(component, /focus-visible:outline-2/);
  assert.match(component, /object-cover object-center/);
  assert.match(styles, /grid-template-columns: repeat\(3/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /\.seasonalFrame/);
});
