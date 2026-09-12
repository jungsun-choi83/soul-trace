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

test("welcome page keeps the supplied motion assets and accessible video behavior", () => {
  assert.match(experience, /src="\/videos\/soul-trace-hero-smooth\.mp4"/);
  assert.match(experience, /poster="\/images\/soul-trace-hero-poster\.jpg"/);
  assert.match(experience, /autoPlay/);
  assert.match(experience, /muted/);
  assert.match(experience, /loop/);
  assert.match(experience, /playsInline/);
  assert.match(experience, /preload="metadata"/);
  assert.match(experience, /object-cover object-\[61%_center\] motion-reduce:hidden sm:object-\[58%_center\] lg:object-\[55%_center\] xl:object-center/);
  assert.match(experience, /min-h-\[100svh\]/);
});

test("welcome page has exact localized explanatory copy", () => {
  assert.deepEqual(en.welcome, {
    eyebrow: "A letter from your pet's heart",
    title: "Your Pet's Story,\nin a Letter",
    description: "Answer a few simple questions about your pet. Soul Trace turns those moments into a personal letter you can keep and share.",
    cta: "Start Creating Your Letter →",
    navHowItWorks: "How It Works",
    howItWorks: "How It Works",
    steps: {
      pet: { title: "Tell us about your pet", body: "Share a few details and memories." },
      questions: { title: "Answer a few questions", body: "We'll guide you through a short, simple set of questions." },
      letter: { title: "Receive your personal letter", body: "Get a heartfelt letter you can keep or share." },
    },
    letterPreview: "To my favorite human,\n\nThank you for all the little moments we've shared.\nEven ordinary days feel special when I'm with you.\n\nAlways yours.",
  });
  assert.deepEqual(ko.welcome, {
    eyebrow: "반려동물의 마음을 담은 편지",
    title: "반려동물의 이야기를\n한 편의 편지로",
    description: "반려동물에 대한 몇 가지 간단한 질문에 답해 주세요. Soul Trace가 그 순간들을 오래 간직하고 나눌 수 있는 특별한 편지로 만들어 드립니다.",
    cta: "편지 만들기 시작하기 →",
    navHowItWorks: "이용 방법",
    howItWorks: "이용 방법",
    steps: {
      pet: { title: "반려동물 소개하기", body: "간단한 정보와 추억을 들려주세요." },
      questions: { title: "간단한 질문에 답하기", body: "짧고 쉬운 질문을 따라 답해 주세요." },
      letter: { title: "나만의 편지 받기", body: "간직하거나 나눌 수 있는 특별한 편지를 받아보세요." },
    },
    letterPreview: "가장 소중한 너에게,\n\n함께한 작은 순간들 모두 고마워.\n너와 함께라면 평범한 하루도 특별해져.\n\n언제나 네 곁에.",
  });
  assert.match(experience, /<LanguageToggle \/>/);
  assert.match(experience, /href="#how-it-works"/);
  assert.match(experience, /id="how-it-works"/);
  assert.match(experience, /data-translucent-letter-preview/);
  assert.match(experience, /backdrop-blur-\[14px\]/);
  assert.match(experience, /scroll-smooth/);
  assert.match(experience, /radial-gradient\(ellipse_at_58%_38%/);
  assert.match(experience, /#0D0A07_100%/);
  assert.match(experience, /function PawIcon/);
  assert.match(experience, /pet: <NoteIcon \/>/);
  assert.match(experience, /questions: <HeartIcon \/>/);
  assert.match(experience, /letter: <EnvelopeIcon \/>/);
  assert.match(experience, /bg-\[#F4E6CC\]\/48/);
  assert.match(experience, /grid grid-cols-3/);
  for (const key of ["eyebrow", "title", "description", "cta", "letterPreview", "howItWorks"]) {
    assert.match(experience, new RegExp(`t\\(\"welcome\\.${key}\"\\)`));
  }
});

test("welcome action keeps the provided authenticated destination and query parameters", () => {
  assert.equal(authEntryPath("/choose"), "/auth?returnTo=%2Fchoose");
  assert.equal(
    authEntryPath("/choose?p=partner-code&campaign=one&campaign=two#mode"),
    "/auth?returnTo=%2Fchoose%3Fp%3Dpartner-code%26campaign%3Done%26campaign%3Dtwo%23mode",
  );
  assert.match(page, /hrefWithSearchParams\("\/choose", params\)/);
  assert.match(page, /choiceHref=\{authEntryPath\(choiceHref\)\}/);
  assert.match(experience, /href=\{choiceHref\}/);
  assert.doesNotMatch(experience, /href=["']\/?(?:auth|choose|living|memorial)/);
});

test("root routing and the welcome alias remain intact", () => {
  assert.match(page, /WelcomeExperience/);
  assert.match(page, /resolvePartnerCode/);
  assert.match(page, /PartnerEntryRedirect/);
  assert.match(page, /PartnerEntryFallback/);
  assert.match(choosePage, /export default async function ModeChoicePage/);
  assert.match(choosePage, /resolvePartnerCode/);
  assert.match(alias, /redirect\(hrefWithSearchParams\("\/", await searchParams\)\)/);
});
