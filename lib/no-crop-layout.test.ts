import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { CLEAN_ART, COMPOSITE_UI_ART, cleanArtSize } from "./design-art.ts";

const scene = readFileSync("components/storybook/story-scene.tsx", "utf8");
const css = readFileSync("app/storybook.css", "utf8");
const auth = readFileSync("components/auth-entry.tsx", "utf8");
const welcome = readFileSync("components/welcome-experience.tsx", "utf8");
const choose = readFileSync("components/mode-choice.tsx", "utf8");
const splashCss = readFileSync("components/SoulTraceSplash.module.css", "utf8");
const dashboard = readFileSync("components/customer-dashboard.tsx", "utf8");
const home = readFileSync("components/pet-first-home.tsx", "utf8");
const memory = readFileSync("components/pet-first-memory.tsx", "utf8");
const settings = readFileSync("components/account-settings.tsx", "utf8");
const petForm = readFileSync("components/pet-form-shell.tsx", "utf8");
const roster = readFileSync("components/pet-roster.tsx", "utf8");
const collar = readFileSync("components/collar-studio.tsx", "utf8");
const paper = readFileSync("components/storybook/paper-shell.tsx", "utf8");
const polaroid = readFileSync("components/polaroid-entry.tsx", "utf8");
const letter = readFileSync("components/soul-trace-flow.tsx", "utf8");

test("main illustrations keep original ratio instead of cover-cropping", () => {
  assert.match(scene, /object-contain/);
  assert.match(scene, /h-auto w-full/);
  assert.match(scene, /width=\{size\.width\}/);
  assert.match(scene, /height=\{size\.height\}/);
  assert.doesNotMatch(scene, /object-cover|fill|object-\[center/);
  assert.match(choose, /object-contain/);
  assert.doesNotMatch(choose, /object-cover|aspect-\[3\/4\]|object-\[center/);
  assert.doesNotMatch(auth, /aspect-\[16\/10\]/);
  assert.doesNotMatch(welcome, /aspect-\[16\/10\]/);
  assert.doesNotMatch(dashboard, /StoryScene[\s\S]{0,80}aspect-/);
  assert.doesNotMatch(home, /StoryScene[\s\S]{0,80}aspect-/);
  assert.doesNotMatch(memory, /aspect-\[16\/11\]|aspect-\[16\/7\]|-mt-14/);
  assert.match(splashCss, /object-fit:contain/);
  assert.match(splashCss, /object-position:center bottom/);
});

test("high-resolution clean art exists and is not a phone screenshot", () => {
  assert.equal(existsSync("public/images/soultrace-splash-background.png"), true);
  assert.equal(existsSync("public/images/soultrace-night-window.png"), true);
  assert.equal(existsSync("public/images/art/corgi-autumn.png"), true);
  assert.equal(existsSync("public/images/art/golden-retriever.png"), true);
  assert.equal(CLEAN_ART.walk, "/images/art/corgi-autumn.png");
  assert.equal(CLEAN_ART.running, "/images/art/golden-retriever.png");
  assert.equal(cleanArtSize(CLEAN_ART.livingHero).width, 1080);
  assert.equal(cleanArtSize(CLEAN_ART.memorialHero).height, 1448);
  for (const banned of COMPOSITE_UI_ART) {
    assert.doesNotMatch(scene, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(choose, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(`${scene}${choose}${auth}${welcome}${dashboard}${home}${memory}`, /screens_live|reference\/0[0-9]/);
});

test("storybook pages scroll and do not clip under a fixed phone-height tab bar", () => {
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /--st-tabbar-height/);
  assert.doesNotMatch(css, /position:\s*fixed/);
  assert.match(paper, /flex min-h-\[100svh\] flex-col/);
  assert.match(auth, /flex-1/);
  assert.match(dashboard, /flex min-h-\[100svh\] flex-col/);
  assert.match(home, /flex min-h-\[100svh\] flex-col/);
  assert.match(memory, /flex min-h-\[100svh\] flex-col/);
  assert.match(settings, /flex min-h-\[100svh\] flex-col/);
  assert.match(petForm, /flex min-h-\[100svh\] flex-col/);
  assert.match(roster, /flex min-h-\[100svh\] flex-col/);
  assert.match(collar, /flex min-h-\[100svh\] flex-col/);
  assert.match(choose, /min-h-\[100svh\]/);
  assert.match(polaroid, /min-h-\[100svh\]/);
  assert.doesNotMatch(`${paper}${auth}${dashboard}${home}${memory}${settings}${petForm}${roster}${collar}`, /h-\[850px\]|h-screen overflow-hidden/);
  assert.match(petForm, /copy\.setupTitle/);
  assert.doesNotMatch(petForm, /UiuxHero|POSE_ART|StoryScene/);
  assert.match(roster, /StoryScene/);
});

test("letter and polaroid generation routes stay in place", () => {
  assert.match(letter, /generate-letter|generateLetter|onGenerate/);
  assert.match(polaroid, /data-polaroid-flow=\{answers\.themeId \|\| "halloween"\}/);
  assert.match(auth, /createPasswordAccount/);
  assert.match(auth, /signInWithPassword/);
});
