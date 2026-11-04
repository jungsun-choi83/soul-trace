import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import {
  markSplashSeen,
  splashAlreadySeen,
  SPLASH_ART_SRC,
  SPLASH_HOLD_MS,
  SPLASH_SESSION_KEY,
} from "./splash-entry.ts";

const splash = readFileSync("components/splash-screen.tsx", "utf8");
const standalone = readFileSync("components/SoulTraceSplash.tsx", "utf8");
const homeEntry = readFileSync("components/home-entry.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const welcome = readFileSync("components/welcome-experience.tsx", "utf8");
const choose = readFileSync("app/choose/page.tsx", "utf8");
const polaroid = readFileSync("app/polaroid/page.tsx", "utf8");
const archive = readFileSync("app/my/pets/page.tsx", "utf8");

test("splash uses the official standalone gouache scene, not a generated stand-in", () => {
  assert.equal(existsSync("public/images/soultrace-splash-background.png"), true);
  assert.equal(existsSync("public/images/soultrace-splash-standalone.png"), true);
  assert.equal(existsSync("public/images/uiux/garden-path.png"), true);
  assert.equal(SPLASH_ART_SRC, "/images/uiux/garden-path.png");
  assert.match(standalone, /SPLASH_ART_SRC/);
  assert.match(standalone, /SoulTrace/);
  assert.match(standalone, /splash\.tagline/);
  assert.doesNotMatch(standalone, /splash-pets|letter-living/);
});

test("SplashScreen is an independent overlay with no entry buttons", () => {
  assert.match(splash, /export function SplashScreen/);
  assert.match(splash, /SoulTraceSplash/);
  assert.doesNotMatch(standalone, /시작하기|로그인|회원가입|Sign up|Log in|Get started|st-btn|StoryTabbar/);
  assert.doesNotMatch(homeEntry, /시작하기|로그인|회원가입|router\.push/);
});

test("splash is session-scoped so first entry is not repeated or held", () => {
  const storage = new Map<string, string>();
  const fake = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
  };
  assert.equal(splashAlreadySeen(fake), false);
  markSplashSeen(fake);
  assert.equal(storage.get(SPLASH_SESSION_KEY), "1");
  assert.equal(splashAlreadySeen(fake), true);
  assert.equal(splashAlreadySeen(null), true);
  assert.ok(SPLASH_HOLD_MS >= 900 && SPLASH_HOLD_MS <= 1200);
  assert.match(homeEntry, /sessionStorage/);
  assert.match(homeEntry, /prefers-reduced-motion/);
});

test("home, letter, polaroid, and archive routes stay in place", () => {
  assert.match(page, /<EntryChoice \/>/);
  assert.match(page, /<HomeEntry>/);
  assert.match(welcome, /choiceHref/);
  assert.match(welcome, /\/create/);
  assert.match(welcome, /\/dashboard/);
  assert.match(choose, /export default async function ModeChoicePage/);
  assert.match(polaroid, /export default/);
  assert.match(archive, /export default/);
  assert.doesNotMatch(page, /\/splash/);
});

test("splash copy exists in both locales without replacing homepage strings", () => {
  assert.deepEqual(Object.keys(en.splash), Object.keys(ko.splash));
  assert.match(ko.splash.tagline, /Eternal Presence/);
  assert.ok(en.splash.tagline.length > 0);
  assert.deepEqual(Object.keys(en.homepage), Object.keys(ko.homepage));
});
