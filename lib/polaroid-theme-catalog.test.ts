import assert from "node:assert/strict";
import test from "node:test";

import {
  everydayPolaroidArtStyles,
  isPolaroidOccasionAdmitted,
  isPolaroidThemeAdmitted,
  isPolaroidThemeSelectable,
  polaroidThemeCatalogEntry,
} from "./polaroid-theme-catalog.ts";
import { polaroidThemeById } from "./polaroid-themes.ts";
import { buildSeasonalPolaroidImagePrompt, fallbackSeasonalPolaroidMemo, validateSeasonalPolaroidMemo } from "./seasonal-polaroid-prompts.ts";
import type { SeasonalPolaroidPromptAnswers } from "./seasonal-polaroid-prompts.ts";

test("halloween stays registered and selectable without new flags", () => {
  assert.equal(polaroidThemeById("halloween")?.id, "halloween");
  assert.equal(isPolaroidThemeSelectable("halloween"), true);
  assert.equal(isPolaroidThemeAdmitted("halloween"), true);
});

test("everyday art styles are felt, gouache, and crayon once year-round is approved", () => {
  assert.equal(polaroidThemeCatalogEntry("felt-doll")?.category, "art-style");
  assert.equal(isPolaroidThemeSelectable("felt-doll", Date.now(), { yearRound: false }), false);
  assert.equal(isPolaroidThemeSelectable("felt-doll", Date.now(), { yearRound: true }), true);
  assert.equal(isPolaroidThemeSelectable("crayon-diary", Date.now(), { yearRound: true }), true);
  const everyday = everydayPolaroidArtStyles({ yearRound: true });
  assert.deepEqual(everyday.map((item) => item.id), ["felt-doll", "gouache-story", "crayon-diary"]);
  assert.equal(isPolaroidThemeSelectable("paper-collage", Date.now(), { yearRound: true, artAll: false }), false);
  assert.ok(!everyday.some((item) => item.id === "paper-collage" || item.id === "starlight-oil" || item.id === "miniature-world"));
});

test("christmas themes stay off until an operator flag is set", () => {
  assert.equal(isPolaroidThemeSelectable("christmas-little-ghost", Date.parse("2026-12-20T00:00:00+09:00"), { christmas: false }), false);
  assert.equal(isPolaroidThemeSelectable("christmas-little-ghost", Date.parse("2026-12-20T00:00:00+09:00"), { christmas: true }), true);
  assert.equal(polaroidThemeCatalogEntry("christmas-little-ghost")?.startAt, "2026-12-01T00:00:00+09:00");
});

test("felt, gouache, and crayon prompts stay distinct and never reuse the Halloween photograph lead", () => {
  const felt: SeasonalPolaroidPromptAnswers = {
    themeId: "felt-doll",
    locale: "ko",
    petName: "코코",
    species: "dog",
    status: "living",
    costume: "knit-scarf",
    scene: "tiny-armchair",
    vibe: "cute-cozy",
    personalities: ["cuddle-bug"],
    habit: "toy-carrier",
    favoriteTreat: "cheese",
    callName: "mom",
  };
  const gouache: SeasonalPolaroidPromptAnswers = {
    ...felt,
    themeId: "gouache-story",
    costume: "picture-cape",
    scene: "meadow-path",
    vibe: "bright-story",
  };
  const crayon: SeasonalPolaroidPromptAnswers = {
    ...felt,
    themeId: "crayon-diary",
    costume: "crayon-bow",
    scene: "diary-page",
    vibe: "handmade-warm",
  };
  const feltPrompt = buildSeasonalPolaroidImagePrompt(felt);
  const gouachePrompt = buildSeasonalPolaroidImagePrompt(gouache);
  const crayonPrompt = buildSeasonalPolaroidImagePrompt(crayon);
  assert.match(feltPrompt, /needle-felted|felt/i);
  assert.match(gouachePrompt, /gouache/i);
  assert.match(crayonPrompt, /crayon/i);
  assert.doesNotMatch(feltPrompt, /emotionally natural Halloween photograph/);
  assert.doesNotMatch(gouachePrompt, /emotionally natural Halloween photograph/);
  assert.doesNotMatch(crayonPrompt, /emotionally natural Halloween photograph/);
  assert.doesNotMatch(feltPrompt, /believable candid photograph/);
  assert.doesNotMatch(gouachePrompt, /needle-felted/);
  assert.doesNotMatch(crayonPrompt, /gouache storybook/);
  const halloweenOccasion = buildSeasonalPolaroidImagePrompt({
    ...felt,
    occasionId: "halloween",
    costume: "pumpkin",
    scene: "pumpkin-patch",
    vibe: "cute-cozy",
  });
  assert.match(halloweenOccasion, /needle-felted|felt/i);
  assert.match(halloweenOccasion, /pumpkin-village/i);
  assert.doesNotMatch(halloweenOccasion, /emotionally natural Halloween photograph/);
  const memo = fallbackSeasonalPolaroidMemo(felt);
  assert.equal(memo.lines.length, 4);
  assert.match(memo.lines[0], /엄마/);
  assert.doesNotMatch(memo.lines[0], /할로윈/);
  assert.equal(validateSeasonalPolaroidMemo(memo, felt).valid, true);
});

test("planned seasonal cards are not registered generation themes", () => {
  assert.equal(polaroidThemeById("newyear-blessing"), undefined);
  assert.equal(isPolaroidThemeSelectable("newyear-blessing"), false);
  assert.equal(isPolaroidOccasionAdmitted("newyear-blessing"), false);
  assert.equal(isPolaroidOccasionAdmitted("halloween"), true);
  assert.equal(isPolaroidOccasionAdmitted("christmas-little-ghost", { christmas: false }), false);
  assert.equal(isPolaroidOccasionAdmitted("christmas-little-ghost", { christmas: true }), true);
});
