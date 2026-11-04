import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import { CLEAN_ART, COMPOSITE_UI_ART } from "./design-art.ts";

const component = readFileSync("components/mode-choice.tsx", "utf8");
const page = readFileSync("app/choose/page.tsx", "utf8");
const scene = readFileSync("components/storybook/story-scene.tsx", "utf8");

test("letter entry uses clean illustrations, not phone screenshots or composited UI cards", () => {
  assert.equal(existsSync("public/images/soultrace-splash-background.png"), true);
  assert.equal(existsSync("public/images/soultrace-night-window.png"), true);
  assert.match(component, /UIUX_GARDEN_HERO/);
  assert.match(component, /UIUX_ROOM_ART/);
  assert.equal(CLEAN_ART.livingHero, "/images/soultrace-splash-background.png");
  assert.equal(CLEAN_ART.memorialHero, "/images/soultrace-night-window.png");
  assert.equal(CLEAN_ART.nightWindow, "/images/soultrace-night-window.png");
  for (const banned of COMPOSITE_UI_ART) {
    assert.doesNotMatch(component, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(component, /screens_live|9:41|LetterHero|text-shadow/);
  assert.doesNotMatch(scene, /sunroom\.jpg|memorial-night\.jpg|letter-scene\.jpg|dog-portrait\.jpg/);
});

test("letter titles stay in HTML once and are not painted on the illustration", () => {
  assert.match(component, /copy\.letterLivingTitle/);
  assert.match(component, /copy\.letterMemorialTitle/);
  assert.doesNotMatch(component, /title=\{copy\.letterLivingHero\}|title=\{copy\.letterMemorialHero\}/);
  assert.doesNotMatch(component, /linear-gradient\(transparent,#362f2260\)/);
  assert.equal(en.landing.livingTitle, "Still By My Side");
  assert.equal(en.landing.memorialTitle, "Forever In My Heart");
  assert.ok(ko.landing.livingTitle.length > 0);
  assert.ok(ko.landing.memorialTitle.length > 0);
});

test("living and memorial letter destinations stay, with polaroid as a secondary action", () => {
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
  assert.match(component, /backHref=\{`\/\$\{querySuffix\}` \|\| "\/"\}/);
  assert.match(component, /new URLSearchParams\(preservedQuery\)/);
});

test("letter entry keeps cream paper chrome and accessible controls", () => {
  assert.match(component, /min-h-\[100svh\]/);
  assert.match(component, /overflow-x-hidden/);
  assert.match(component, /bg-\[#fffaf0\]/);
  assert.match(component, /rounded-\[13px\]/);
  assert.match(component, /current="create"/);
  assert.match(component, /StoryTabbar/);
});
