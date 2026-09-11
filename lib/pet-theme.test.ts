import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  DEFAULT_PET_THEME,
  getPetTheme,
  getQuestionnairePetTheme,
  PET_THEMES,
} from "./pet-theme.ts";

test("supported stable pet type IDs resolve to their matching future theme", () => {
  for (const petType of ["dog", "cat", "rabbit", "hamster", "bird"] as const) {
    assert.equal(getPetTheme(petType), PET_THEMES[petType]);
    assert.equal(getPetTheme(petType.toUpperCase()).key, petType);
  }
});

test("central configuration owns every supported pet background path", () => {
  for (const petType of ["dog", "cat", "rabbit", "hamster", "bird"] as const) {
    assert.equal(PET_THEMES[petType].background, `/backgrounds/pets/${petType}-bg.png`);
    assert.equal(existsSync(`public${PET_THEMES[petType].background}`), true);
  }
  assert.equal(DEFAULT_PET_THEME.background, null);
});

test("other, missing, empty, and unknown pet types retain the neutral theme", () => {
  for (const petType of ["other", undefined, null, "", "  ", "unknown-animal"]) {
    assert.equal(getPetTheme(petType), DEFAULT_PET_THEME);
  }
});

test("pet theming remains neutral through Question 2 and follows the latest answer afterward", () => {
  assert.equal(getQuestionnairePetTheme("dog", false), DEFAULT_PET_THEME);
  assert.equal(getQuestionnairePetTheme("dog", true).key, "dog");
  assert.equal(getQuestionnairePetTheme("bird", true).key, "bird");
});

test("questionnaire background wiring reuses petIntro state and centralized paths", () => {
  const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
  assert.match(
    flow,
    /getQuestionnairePetTheme\(\s*petIntro\.petType,\s*petTypeQuestionCompleted,?\s*\)/,
  );
  assert.match(flow, /data-questionnaire-pet-theme=\{questionnairePetTheme\.key\}/);
  assert.doesNotMatch(flow, /useState<[^>]*PetTheme|setPetTheme/);
  assert.match(flow, /src=\{questionnairePetTheme\.background\}/);
  assert.match(flow, /data-questionnaire-pet-background/);
  assert.match(flow, /object-cover[\s\S]*sm:object-center/);
  assert.match(flow, /bg-black\/70 sm:bg-black\/60/);
  assert.doesNotMatch(flow, /backgrounds\/pets\/(?:dog|cat|rabbit|hamster|bird)-bg/);
});

test("localized labels stay separate from stable pet type identifiers", () => {
  const form = readFileSync("components/pet-intro-form.tsx", "utf8");
  assert.match(form, /onChange\(\{ petType: type, petBreed: "" \}\)/);
  assert.match(form, /t\(`form\.step1\.petTypes\.\$\{type\}`\)/);
});

test("Living and Memorial in Korean and English share the same pet-only resolver", () => {
  const expectations = {
    dog: "dog",
    cat: "cat",
    bird: "bird",
    other: "default",
  } as const;

  for (const mode of ["living", "memorial"] as const) {
    for (const locale of ["en", "ko"] as const) {
      for (const [petType, expected] of Object.entries(expectations)) {
        assert.equal(
          getQuestionnairePetTheme(petType, true).key,
          expected,
          `${mode}/${locale}/${petType}`,
        );
      }
    }
  }

  const source = readFileSync("lib/pet-theme.ts", "utf8");
  assert.doesNotMatch(source, /LetterMode|\bmode\b|Locale|\blang\b/);
  assert.match(readFileSync("app/living/page.tsx", "utf8"), /<SoulTraceFlow mode="living"/);
  assert.match(readFileSync("app/memorial/page.tsx", "utf8"), /<SoulTraceFlow mode="memorial"/);
});
