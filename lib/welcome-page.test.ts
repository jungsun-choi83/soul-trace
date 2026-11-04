import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };

const page = readFileSync("app/page.tsx", "utf8");
const alias = readFileSync("app/welcome/page.tsx", "utf8");
const choosePage = readFileSync("app/choose/page.tsx", "utf8");
const experience = readFileSync("components/welcome-experience.tsx", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

test("welcome experience is the cream paper guest start screen", () => {
  for (const token of ["EternalBeamLogo", "choiceHref", "/create", "/dashboard"]) {
    assert.match(experience, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(experience, /welcomeGuestLetter|welcomeLetter|welcomeHint|welcomeSubtitle/);
  assert.doesNotMatch(experience, /Kickstarter|KICKSTARTER|HomepageHeader|KickstarterPromo/);
});

test("homepage uses the existing locale system with complete English and Korean copy", () => {
  assert.deepEqual(Object.keys(en.homepage), Object.keys(ko.homepage));
  assert.match(experience, /useLocale/);
  assert.doesNotMatch(experience, /LanguageProvider|LanguageSwitch|useLanguage/);
});

test("homepage and letter result do not show Kickstarter", () => {
  assert.doesNotMatch(experience, /Kickstarter|KICKSTARTER/);
  assert.doesNotMatch(page, /Kickstarter|KICKSTARTER/);
  assert.doesNotMatch(flow, /Kickstarter|KICKSTARTER|kickstarter-promo/);
});

test("splash is followed by two different home choices", () => {
  const choice = readFileSync("components/entry-choice.tsx", "utf8");
  assert.match(page, /<HomeEntry>/);
  assert.match(page, /<EntryChoice \/>/);
  assert.match(choice, /entryHomePath\("living"/);
  assert.match(choice, /entryHomePath\("memorial"/);
  assert.match(readFileSync("lib/entry-branch.ts", "utf8"), /\/dashboard\/living/);
  assert.match(readFileSync("lib/entry-branch.ts", "utf8"), /\/dashboard\/memorial/);
  assert.match(choice, /함께 있는 아이로 시작하기/);
  assert.match(choice, /구름 위의 아이로 시작하기/);
  assert.doesNotMatch(page, /redirect\("\/splash"\)|href="\/splash"/);
});

test("root partner routing and the welcome alias remain intact", () => {
  assert.match(page, /EntryChoice/);
  assert.match(page, /HomeEntry/);
  assert.match(page, /resolvePartnerCode/);
  assert.match(page, /PartnerEntryRedirect/);
  assert.match(page, /PartnerEntryFallback/);
  assert.match(choosePage, /export default async function ModeChoicePage/);
  assert.match(choosePage, /resolvePartnerCode/);
  assert.match(choosePage, /partnerEntryDestination/);
  assert.match(choosePage, /parseServiceChannel/);
  assert.match(alias, /redirect\(hrefWithSearchParams\("\/", await searchParams\)\)/);
});

test("homepage still lives at / and is not replaced by splash", () => {
  assert.match(page, /<HomeEntry>/);
  assert.match(page, /<EntryChoice \/>/);
  assert.doesNotMatch(page, /redirect\("\/splash"\)|href="\/splash"/);
});
