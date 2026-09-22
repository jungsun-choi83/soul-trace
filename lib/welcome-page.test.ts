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
const footer = readFileSync("components/homepage/homepage-footer.tsx", "utf8");
const kickstarterPromo = readFileSync("components/homepage/kickstarter-promo.tsx", "utf8");
const kickstarterWaitlistRoute = readFileSync("app/api/kickstarter-waitlist/route.ts", "utf8");
const kickstarterWaitlistMigration = readFileSync("supabase/migration_add_kickstarter_waitlist.sql", "utf8");
const homepageSources = [header, hero, hologram, finalCta].join("\n");

test("welcome experience renders only the approved homepage composition", () => {
  for (const component of [
    "HomepageHeader", "Hero", "LittleMoments", "HowItWorks", "LetterPreview",
    "PetGallery", "EternalBeam", "HologramPreview", "ConnectionJourney",
    "LivingMemorial", "FinalCta", "KickstarterPromo", "HomepageFooter",
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

test("homepage navigation starts with How It Works instead of a duplicate Soul Trace link", () => {
  assert.doesNotMatch(header, /homepage\.nav\.soulTrace/);
  assert.match(header, /homepage\.nav\.howItWorks/);
});

test("homepage navigation includes the spaced Kickstarter launch CTA after About", () => {
  const about = header.indexOf('t("homepage.nav.about")');
  const kickstarter = header.indexOf("<KickstarterNavLink />");
  assert.ok(about >= 0 && about < kickstarter);
  assert.match(header, /🚀/);
  assert.match(header, /Launching soon on Kickstarter/);
  assert.match(header, /NEXT_PUBLIC_KICKSTARTER_URL/);
  assert.match(header, /<KickstarterNavLink mobile \/>/);
});

test("homepage places the localized Kickstarter banner directly after the final CTA", () => {
  const finalCta = experience.indexOf("<FinalCta choiceHref={choiceHref} />");
  const banner = experience.indexOf("<KickstarterPromo />");
  assert.ok(finalCta >= 0 && finalCta < banner);
  assert.match(kickstarterPromo, /comingsoon\.png/);
  assert.match(kickstarterPromo, /comingsoon-ko\.png/);
  assert.match(kickstarterPromo, /aspect-\[1916\/821\] w-full/);
  assert.match(kickstarterPromo, /inset-x-0 top-0 h-auto w-full/);
  assert.doesNotMatch(kickstarterPromo, /max-w-5xl|max-w-7xl/);
});

test("Kickstarter artwork exposes localized interactive buttons and waitlist feedback", () => {
  assert.match(kickstarterPromo, /onClick=\{openDialog\}/);
  assert.match(kickstarterPromo, /NEXT_PUBLIC_KICKSTARTER_URL/);
  assert.match(kickstarterPromo, /href=\{KICKSTARTER_URL\}/);
  assert.match(kickstarterPromo, /fetch\("\/api\/kickstarter-waitlist"/);
  assert.match(kickstarterPromo, /type="email"/);
  assert.match(kickstarterPromo, /homepage\.kickstarter\.success/);
  assert.equal(en.homepage.kickstarter.success, "You are on the list");
});

test("Kickstarter waitlist validates and persists unique email signups server-side", () => {
  assert.match(kickstarterWaitlistRoute, /EMAIL_PATTERN/);
  assert.match(kickstarterWaitlistRoute, /createSupabaseServerClient/);
  assert.match(kickstarterWaitlistRoute, /\.from\("kickstarter_waitlist"\)/);
  assert.match(kickstarterWaitlistRoute, /onConflict: "email"/);
  assert.match(kickstarterWaitlistMigration, /email text not null unique/);
  assert.match(kickstarterWaitlistMigration, /enable row level security/);
  assert.match(kickstarterWaitlistMigration, /revoke all.*anon, authenticated/);
});

test("homepage follows the official Eternal Beam Facebook account", () => {
  assert.match(experience, /getEternalBeamFacebookUrl/);
  assert.match(experience, /aria-label="Follow Eternal Beam on Facebook"/);
  assert.match(experience, /<FaFacebookF aria-hidden="true"/);
  assert.doesNotMatch(experience, /getEternalBeamTiktokUrl|Follow Eternal Beam on TikTok|<FaTiktok/);
});

test("footer Contact Us opens a blank email to Eternal Beam", () => {
  assert.match(footer, /href="mailto:hello@eternalbeamapp\.com"/);
  assert.doesNotMatch(footer, /mailto:[^"']*[?&](?:subject|body)=/i);
});

test("every creation CTA receives and uses the query-preserving choiceHref", () => {
  assert.match(page, /hrefWithSearchParams\("\/choose", params\)/);
  assert.match(page, /choiceHref=\{choiceHref\}/);
  for (const source of [header, hero, finalCta]) {
    assert.match(source, /choiceHref: string/);
    assert.match(source, /href=\{choiceHref\}/);
    assert.doesNotMatch(source, /href=["']\/(?:choose|living|memorial)/);
  }
  assert.match(hologram, /href=\{getEternalBeamMainUrl\(\)\}/);
  assert.match(hologram, /homepage\.hologram\.cta/);
});

test("approved homepage assets exist and hologram media remains isolated", () => {
  for (const path of [
    "public/homepage/pets/hero-dog.png", "public/homepage/moments/moment-sleep.png",
    "public/homepage/moments/moment-wait.png", "public/homepage/moments/moment-bond.png",
    "public/homepage/pets/gallery-dog.png", "public/homepage/pets/gallery-cat.png",
    "public/homepage/pets/gallery-rabbit.png", "public/homepage/pets/gallery-bird.png",
    "public/homepage/pets/gallery-hamster.png", "public/homepage/eternal-beam/cinematic.png",
    "public/homepage/eternal-beam/hologram-pet.png",
    "public/images/comingsoon.png", "public/images/comingsoon-ko.png",
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
