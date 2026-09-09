import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import { authEntryPath } from "./auth-redirect.ts";

const page = readFileSync("app/page.tsx", "utf8");
const alias = readFileSync("app/welcome/page.tsx", "utf8");
const choosePage = readFileSync("app/choose/page.tsx", "utf8");
const experience = readFileSync("components/welcome-experience.tsx", "utf8");
const existingHomePage = readFileSync("app/page.tsx", "utf8");

test("welcome page uses the supplied motion assets and required video behavior", () => {
  assert.match(experience, /src="\/videos\/soul-trace-hero-smooth\.mp4"/);
  assert.match(experience, /poster="\/images\/soul-trace-hero-poster\.jpg"/);
  assert.match(experience, /autoPlay/);
  assert.match(experience, /muted/);
  assert.match(experience, /loop/);
  assert.match(experience, /playsInline/);
  assert.match(experience, /preload="metadata"/);
  assert.match(experience, /object-cover object-center motion-reduce:hidden/);
  assert.match(experience, /h-\[92svh\]/);
});

test("welcome page has exact localized title and call to action", () => {
  assert.deepEqual(en.welcome, {
    title: "A letter from the heart",
    cta: "Begin Your Journey",
  });
  assert.deepEqual(ko.welcome, {
    title: "마음에서 온 편지",
    cta: "여정을 시작하세요",
  });
  assert.match(experience, /<LanguageToggle \/>/);
});

test("welcome action enters auth with an encoded choose destination", () => {
  assert.equal(authEntryPath("/choose"), "/auth?returnTo=%2Fchoose");
  assert.equal(
    authEntryPath("/choose?p=partner-code&campaign=one&campaign=two#mode"),
    "/auth?returnTo=%2Fchoose%3Fp%3Dpartner-code%26campaign%3Done%26campaign%3Dtwo%23mode",
  );
  assert.match(page, /hrefWithSearchParams\("\/choose", params\)/);
  assert.match(page, /choiceHref=\{authEntryPath\(choiceHref\)\}/);
  assert.match(experience, /href=\{choiceHref\}/);
});

test("root is welcome, choose contains the existing choice flow, and welcome remains an alias", () => {
  assert.match(existingHomePage, /WelcomeExperience/);
  assert.match(choosePage, /export default async function ModeChoicePage/);
  assert.match(choosePage, /resolvePartnerCode/);
  assert.match(alias, /redirect\(hrefWithSearchParams\("\/", await searchParams\)\)/);
});
