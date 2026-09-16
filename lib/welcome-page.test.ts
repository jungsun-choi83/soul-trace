import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };

const page = readFileSync("app/page.tsx", "utf8");
const alias = readFileSync("app/welcome/page.tsx", "utf8");
const choosePage = readFileSync("app/choose/page.tsx", "utf8");
const experience = readFileSync("components/welcome-experience.tsx", "utf8");
const header = readFileSync("components/homepage/homepage-header.tsx", "utf8");
const hero = readFileSync("components/homepage/hero.tsx", "utf8");
const hologram = readFileSync("components/homepage/hologram-preview.tsx", "utf8");
const finalCta = readFileSync("components/homepage/final-cta.tsx", "utf8");
const homepageSources = [header, hero, hologram, finalCta].join("\n");

test("welcome experience renders only the approved homepage composition", () => {
  for (const component of [
    "HomepageHeader", "Hero", "LittleMoments", "HowItWorks", "LetterPreview",
    "PetGallery", "EternalBeam", "HologramPreview", "ConnectionJourney",
    "LivingMemorial", "FinalCta", "HomepageFooter",
  ]) assert.match(experience, new RegExp(`<${component}`));

  assert.doesNotMatch(experience, /soul-trace-hero-smooth|data-translucent-letter-preview|STEP_KEYS/);
});

test("homepage uses the existing locale system with complete English and Korean copy", () => {
  assert.deepEqual(Object.keys(en.homepage), Object.keys(ko.homepage));
  assert.match(header, /<LanguageToggle \/>/);
  assert.match(header, /useLocale/);
  assert.doesNotMatch(homepageSources, /LanguageProvider|LanguageSwitch|useLanguage/);
  assert.equal(ko.homepage.hero.primary, "우리 아이 편지 만들기");
  assert.equal(ko.homepage.livingMemorial.memorialTitle, "언제나 기억하며");
});

test("every creation CTA receives and uses the query-preserving choiceHref", () => {
  assert.match(page, /hrefWithSearchParams\("\/choose", params\)/);
  assert.match(page, /choiceHref=\{choiceHref\}/);
  for (const source of [header, hero, hologram, finalCta]) {
    assert.match(source, /choiceHref: string/);
    assert.match(source, /href=\{choiceHref\}/);
    assert.doesNotMatch(source, /href=["']\/(?:choose|living|memorial)/);
  }
});

test("approved homepage assets exist and hologram media remains isolated", () => {
  for (const path of [
    "public/homepage/pets/hero-dog.png", "public/homepage/moments/moment-sleep.png",
    "public/homepage/moments/moment-wait.png", "public/homepage/moments/moment-bond.png",
    "public/homepage/pets/gallery-dog.png", "public/homepage/pets/gallery-cat.png",
    "public/homepage/pets/gallery-rabbit.png", "public/homepage/pets/gallery-bird.png",
    "public/homepage/pets/gallery-hamster.png", "public/homepage/eternal-beam/cinematic.png",
    "public/homepage/eternal-beam/hologram-pet.png",
  ]) assert.equal(existsSync(path), true, path);
  assert.match(hologram, /function ProjectedPet/);
  assert.match(hologram, /homepage\/eternal-beam\/hologram-pet\.png/);
});

test("root partner routing and the welcome alias remain intact", () => {
  assert.match(page, /WelcomeExperience/);
  assert.match(page, /resolvePartnerCode/);
  assert.match(page, /PartnerEntryRedirect/);
  assert.match(page, /PartnerEntryFallback/);
  assert.match(choosePage, /export default async function ModeChoicePage/);
  assert.match(choosePage, /resolvePartnerCode/);
  assert.match(alias, /redirect\(hrefWithSearchParams\("\/", await searchParams\)\)/);
});
