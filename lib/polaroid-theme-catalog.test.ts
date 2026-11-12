import assert from "node:assert/strict";
import test from "node:test";

import {
  everydayPolaroidArtStyles,
  isPolaroidOccasionAdmitted,
  isPolaroidThemeAdmitted,
  isPolaroidThemeSelectable,
  POLAROID_OCCASION_GROUPS,
  polaroidOccasionItem,
  polaroidThemeCatalogEntry,
} from "./polaroid-theme-catalog.ts";
import { polaroidThemeById } from "./polaroid-themes.ts";
import {
  buildSeasonalPolaroidCreativeBrief,
  buildSeasonalPolaroidImagePrompt,
  buildSeasonalPolaroidMemoSystemPrompt,
  fallbackSeasonalPolaroidMemo,
  seasonalPolaroidResultCostumeId,
  validateSeasonalPolaroidMemo,
} from "./seasonal-polaroid-prompts.ts";
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
  assert.equal(new Set([feltPrompt, gouachePrompt, crayonPrompt]).size, 3);
  assert.match(feltPrompt, /needle-felted/i);
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
  assert.match(halloweenOccasion, /pumpkin-village/i);
  // A Halloween occasion on a felt frame keeps the felt medium and tells the
  // occasion through setting and props only.
  assert.match(halloweenOccasion, /needle-felted/i);
  assert.match(halloweenOccasion, /Keep the chosen art medium unchanged/);
  assert.doesNotMatch(halloweenOccasion, /emotionally natural Halloween photograph/);
  const memo = fallbackSeasonalPolaroidMemo(felt);
  assert.equal(memo.lines.length, 4);
  assert.match(memo.lines[0], /엄마/);
  assert.doesNotMatch(memo.lines[0], /할로윈/);
  assert.equal(validateSeasonalPolaroidMemo(memo, felt).valid, true, JSON.stringify({ memo, validation: validateSeasonalPolaroidMemo(memo, felt) }));
});

test("new art styles without an occasion stay distinct in image prompts and share non-Halloween fallback captions", () => {
  const styles: Array<{
    themeId: string;
    scene: string;
    vibe: string;
  }> = [
    { themeId: "felt-doll", scene: "tiny-armchair", vibe: "cute-cozy" },
    { themeId: "gouache-story", scene: "meadow-path", vibe: "bright-story" },
    { themeId: "crayon-diary", scene: "diary-page", vibe: "handmade-warm" },
  ];
  const imagePrompts: string[] = [];
  const captionPrompts: string[] = [];
  const fallbackCaptions: string[] = [];

  for (const item of styles) {
    const answers: SeasonalPolaroidPromptAnswers = {
      themeId: item.themeId,
      locale: "en",
      petName: "Mochi",
      species: "cat",
      status: "living",
      costume: "surprise",
      scene: item.scene,
      vibe: item.vibe,
      personalities: ["cuddle-bug"],
      habit: "sunbeam-napper",
      favoriteTreat: "tuna",
      callName: "mom",
    };
    const imagePrompt = buildSeasonalPolaroidImagePrompt(answers);
    const captionPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, item.themeId);
    const fallback = fallbackSeasonalPolaroidMemo(answers);

    imagePrompts.push(imagePrompt);
    captionPrompts.push(captionPrompt);
    fallbackCaptions.push(fallback.lines.join("\n"));
    assert.match(imagePrompt, /POSE AND SCENE FIT/);
    assert.doesNotMatch(imagePrompt, /COSTUME:|SCENE:|VIBE:|COSTUME FIT/i);
    assert.doesNotMatch(imagePrompt, /Halloween|pumpkin village|vampire|witch/i);
    assert.doesNotMatch(imagePrompt, /knit scarf|tiny armchair|cute, cozy/i);
    assert.doesNotMatch(captionPrompt, /Halloween/i);
    assert.match(captionPrompt, /ignore the required legacy costume, scene, and vibe fields/i);
    assert.doesNotMatch(captionPrompt, /Felt Doll|Gouache Storybook|Crayon Diary/i);
    assert.doesNotMatch(captionPrompt, /Prioritize details.*costume.*scene or vibe/i);
    assert.doesNotMatch(fallback.lines.join(" "), /Halloween|pumpkin|vampire|witch/i);
    assert.doesNotMatch(fallback.lines.join(" "), /costume|knit scarf|tiny armchair|cute, cozy/i);
    assert.doesNotMatch(fallback.lines.join(" "), /felt|gouache|crayon/i);
    assert.equal(validateSeasonalPolaroidMemo(fallback, answers).valid, true);
    assert.equal(seasonalPolaroidResultCostumeId(answers), "");

    const koreanAnswers = { ...answers, locale: "ko" as const, petName: "코코" };
    const koreanFallback = fallbackSeasonalPolaroidMemo(koreanAnswers);
    assert.equal(koreanFallback.lines.length, 4);
    assert.equal(validateSeasonalPolaroidMemo(koreanFallback, koreanAnswers).valid, true);
  }

  // Image prompts carry the chosen medium, so the three must differ.
  assert.equal(new Set(imagePrompts).size, 3);
  assert.match(imagePrompts[0]!, /needle-felted/i);
  assert.match(imagePrompts[1]!, /gouache/i);
  assert.match(imagePrompts[2]!, /crayon/i);
  // Captions stay frame-independent.
  assert.equal(captionPrompts[0], captionPrompts[1]);
  assert.equal(captionPrompts[1], captionPrompts[2]);
  assert.equal(fallbackCaptions[0], fallbackCaptions[1]);
  assert.equal(fallbackCaptions[1], fallbackCaptions[2]);
});

test("Gouache plus a Christmas occasion stays Christmas in image and caption prompts", () => {
  const gouacheChristmas: SeasonalPolaroidPromptAnswers = {
    themeId: "gouache-story",
    occasionId: "christmas-little-ghost",
    locale: "en",
    petName: "Mochi",
    species: "cat",
    status: "living",
    costume: "surprise",
    scene: "candle-window",
    vibe: "christmas-cozy",
    personalities: ["cuddle-bug"],
    habit: "sunbeam-napper",
    favoriteTreat: "tuna",
    callName: "mom",
  };
  const imagePrompt = buildSeasonalPolaroidImagePrompt(gouacheChristmas);
  const captionPrompt = buildSeasonalPolaroidMemoSystemPrompt(
    "en",
    "living",
    undefined,
    gouacheChristmas.themeId,
    gouacheChristmas.occasionId,
  );
  const fallback = fallbackSeasonalPolaroidMemo(gouacheChristmas);

  // The Gouache medium is kept; the occasion is told through setting and props.
  assert.match(imagePrompt, /gouache/i);
  assert.doesNotMatch(imagePrompt, /needle-felted/i);
  assert.match(imagePrompt, /Keep the chosen art medium unchanged/);
  assert.match(imagePrompt, /gentle Christmas night|Christmas/i);
  assert.doesNotMatch(imagePrompt, /COSTUME:|SCENE:|VIBE:|COSTUME FIT/i);
  assert.doesNotMatch(imagePrompt, /Halloween|pumpkin village|vampire|witch/i);
  assert.match(captionPrompt, /Christmas.*keepsake/i);
  assert.doesNotMatch(captionPrompt, /Felt Doll|Gouache Storybook|Crayon Diary/i);
  assert.doesNotMatch(captionPrompt, /Halloween/i);
  assert.match(captionPrompt, /ignore the required legacy costume, scene, and vibe fields/i);
  assert.doesNotMatch(fallback.lines.join(" "), /Halloween|pumpkin|vampire|witch/i);
  assert.doesNotMatch(fallback.lines.join(" "), /costume|candlelit window/i);
  assert.equal(validateSeasonalPolaroidMemo(fallback, gouacheChristmas).valid, true);
  assert.equal(seasonalPolaroidResultCostumeId(gouacheChristmas), "");
  for (const themeId of ["felt-doll", "crayon-diary"]) {
    const sameOccasion = { ...gouacheChristmas, themeId };
    // The medium changes with the art style; the Christmas occasion does not.
    const otherPrompt = buildSeasonalPolaroidImagePrompt(sameOccasion);
    assert.notEqual(otherPrompt, imagePrompt);
    assert.match(otherPrompt, /gentle Christmas night/i);
    assert.match(otherPrompt, /Keep the chosen art medium unchanged/);
    assert.equal(
      buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, themeId, gouacheChristmas.occasionId),
      captionPrompt,
    );
    assert.equal(fallbackSeasonalPolaroidMemo(sameOccasion).lines.join("\n"), fallback.lines.join("\n"));
  }
});

test("an explicit non-Halloween occasion overrides a stale Halloween theme fallback", () => {
  const answers: SeasonalPolaroidPromptAnswers = {
    themeId: "halloween",
    occasionId: "christmas-little-ghost",
    locale: "en",
    petName: "Mochi",
    species: "cat",
    status: "living",
    costume: "surprise",
    scene: "candle-window",
    vibe: "christmas-cozy",
    personalities: ["cuddle-bug"],
    habit: "sunbeam-napper",
    favoriteTreat: "tuna",
    callName: "mom",
  };
  const imagePrompt = buildSeasonalPolaroidImagePrompt(answers);
  const captionPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, answers.themeId, answers.occasionId);
  const fallback = fallbackSeasonalPolaroidMemo(answers);

  assert.match(imagePrompt, /gentle Christmas night|Christmas/i);
  assert.doesNotMatch(imagePrompt, /emotionally natural Halloween photograph|Halloween|pumpkin village/i);
  assert.match(captionPrompt, /Christmas.*keepsake/i);
  assert.doesNotMatch(captionPrompt, /Halloween/i);
  assert.doesNotMatch(fallback.lines.join(" "), /Halloween|pumpkin|vampire|witch/i);
});

test("explicit Halloween art-style requests use Halloween direction and greeting", () => {
  const answers: SeasonalPolaroidPromptAnswers = {
    themeId: "gouache-story",
    occasionId: "halloween",
    locale: "en",
    petName: "Mochi",
    species: "cat",
    status: "living",
    costume: "pumpkin",
    scene: "pumpkin-patch",
    vibe: "cute-cozy",
    personalities: ["cuddle-bug"],
    habit: "sunbeam-napper",
    favoriteTreat: "tuna",
    callName: "mom",
  };
  const imagePrompt = buildSeasonalPolaroidImagePrompt(answers);
  const captionPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, answers.themeId, answers.occasionId);
  const fallback = fallbackSeasonalPolaroidMemo(answers);

  assert.match(imagePrompt, /gouache/i);
  assert.doesNotMatch(imagePrompt, /needle-felted/i);
  assert.match(imagePrompt, /pumpkin-village/i);
  assert.doesNotMatch(imagePrompt, /COSTUME:|SCENE:|VIBE:|COSTUME FIT/i);
  assert.match(captionPrompt, /Halloween Polaroid/i);
  assert.match(captionPrompt, /happy Halloween/i);
  assert.match(fallback.lines[0]!, /happy Halloween/i);
  assert.equal(validateSeasonalPolaroidMemo(fallback, answers).valid, true);
  assert.equal(seasonalPolaroidResultCostumeId(answers), "");
});

test("legacy Halloween requests without an occasion keep their original image and caption behavior", () => {
  const legacy: SeasonalPolaroidPromptAnswers = {
    themeId: "halloween",
    locale: "en",
    petName: "Mochi",
    species: "cat",
    status: "living",
    costume: "pumpkin",
    scene: "pumpkin-patch",
    vibe: "cute-cozy",
    personalities: ["cuddle-bug"],
    habit: "sunbeam-napper",
    favoriteTreat: "tuna",
    callName: "mom",
  };
  const imagePrompt = buildSeasonalPolaroidImagePrompt(legacy);
  const captionPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, legacy.themeId);
  const fallback = fallbackSeasonalPolaroidMemo(legacy);

  assert.match(imagePrompt, /emotionally natural Halloween photograph/i);
  assert.match(imagePrompt, /COSTUME:[\s\S]*SCENE:[\s\S]*VIBE:/);
  assert.match(imagePrompt, /COSTUME FIT:/);
  assert.match(imagePrompt, /enough surrounding seasonal context to read as Halloween/i);
  assert.match(captionPrompt, /Halloween Polaroid/i);
  assert.match(fallback.lines[0]!, /happy Halloween/i);
  assert.equal(validateSeasonalPolaroidMemo(fallback, legacy).valid, true);
  assert.equal(seasonalPolaroidResultCostumeId(legacy), "pumpkin");
});

test("New Year is enabled as an occasion but not registered as a frame theme", () => {
  assert.equal(polaroidThemeById("newyear-blessing"), undefined);
  assert.equal(isPolaroidThemeSelectable("newyear-blessing"), false);
  assert.equal(polaroidOccasionItem("newyear-blessing")?.implemented, true);
  assert.equal(isPolaroidOccasionAdmitted("newyear-blessing"), true);
  assert.equal(polaroidOccasionItem("valentine-letter")?.implemented, true);
  assert.equal(polaroidOccasionItem("spring-secret-garden")?.implemented, true);
  assert.equal(polaroidOccasionItem("summer-seaside")?.implemented, true);
  assert.equal(polaroidOccasionItem("halloween-mischief-ghost")?.implemented, true);
  assert.equal(isPolaroidOccasionAdmitted("valentine-letter"), true);
  assert.equal(isPolaroidOccasionAdmitted("spring-secret-garden"), true);
  assert.equal(isPolaroidOccasionAdmitted("summer-seaside"), true);
  assert.equal(isPolaroidOccasionAdmitted("halloween-mischief-ghost"), true);
  assert.equal(isPolaroidOccasionAdmitted("halloween"), true);
  assert.equal(isPolaroidOccasionAdmitted("christmas-little-ghost", { christmas: false }), false);
  assert.equal(isPolaroidOccasionAdmitted("christmas-little-ghost", { christmas: true }), true);
});

test("the full 12-occasion catalog is implemented, with Christmas still behind its flag", () => {
  const catalog = POLAROID_OCCASION_GROUPS.flatMap((group) => group.items);
  const implemented = catalog
    .filter((item) => item.implemented)
    .map((item) => item.id)
    .sort();
  assert.deepEqual(implemented, [
    "adoption-day", "birthday-star", "christmas-first-snow-post", "christmas-little-ghost",
    "christmas-santa-workshop", "christmas-snow-globe", "halloween", "halloween-mischief-ghost",
    "newyear-blessing", "spring-secret-garden", "summer-seaside", "valentine-letter",
  ].sort());
  assert.equal(polaroidOccasionItem("birthday-star")?.implemented, true, "the UI should render Birthday as available");
  assert.equal(isPolaroidOccasionAdmitted("adoption-day"), true);
  assert.equal(isPolaroidOccasionAdmitted("birthday-star"), true);
  assert.equal(isPolaroidOccasionAdmitted("newyear-blessing"), true);
  assert.equal(isPolaroidOccasionAdmitted("valentine-letter"), true);
  assert.equal(isPolaroidOccasionAdmitted("spring-secret-garden"), true);
  assert.equal(isPolaroidOccasionAdmitted("summer-seaside"), true);
  assert.equal(isPolaroidOccasionAdmitted("halloween-mischief-ghost"), true);
  const christmasIds = [
    "christmas-little-ghost",
    "christmas-santa-workshop",
    "christmas-first-snow-post",
    "christmas-snow-globe",
  ];
  for (const occasionId of christmasIds) {
    assert.equal(polaroidOccasionItem(occasionId)?.implemented, true);
    assert.equal(isPolaroidOccasionAdmitted(occasionId, { christmas: false }), false);
    assert.equal(isPolaroidOccasionAdmitted(occasionId, { christmas: true }), true);
  }
  assert.equal(catalog.filter((item) => item.implemented).length, 12);
});

test("Birthday prompts and four-line fallbacks are frame-independent, bilingual, and avoid invented details", () => {
  const frames: SeasonalPolaroidPromptAnswers[] = [
    { themeId: "felt-doll", occasionId: "birthday-star", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
    { themeId: "gouache-story", occasionId: "birthday-star", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
    { themeId: "crayon-diary", occasionId: "birthday-star", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
  ];
  const imagePrompts = frames.map((answers) => buildSeasonalPolaroidImagePrompt(answers));
  const captionPrompts = frames.map((answers) => buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, answers.themeId, answers.occasionId));
  const fallbacks = frames.map((answers) => fallbackSeasonalPolaroidMemo(answers));

  // Each art style keeps its own medium, while the occasion content stays
  // identical across all three.
  assert.equal(new Set(imagePrompts).size, 3);
  for (const prompt of imagePrompts) assert.match(prompt, /birthday celebration centered on the supplied pet/i);
  assert.equal(captionPrompts[0], captionPrompts[1]);
  assert.equal(captionPrompts[1], captionPrompts[2]);
  assert.deepEqual(fallbacks[0], fallbacks[1]);
  assert.deepEqual(fallbacks[1], fallbacks[2]);
  assert.match(imagePrompts[0]!, /birthday celebration centered on the supplied pet/i);
  assert.match(imagePrompts[0]!, /Do not add people, candles, cake, age numbers, dates/i);
  assert.match(captionPrompts[0]!, /warm birthday-themed keepsake/i);
  assert.match(captionPrompts[0]!, /do not invent an age, date, people, gifts, candles, cake, party details, or memories/i);
  assert.match(captionPrompts[0]!, /Use only supplied pet details and personalTouch/i);
  assert.doesNotMatch(imagePrompts[0]!, /Halloween|pumpkin|vampire/i);
  assert.doesNotMatch(captionPrompts[0]!, /Halloween/i);
  assert.equal(fallbacks[0]!.lines.length, 4);
  assert.match(fallbacks[0]!.lines[3]!, /little celebration/i);
  assert.equal(validateSeasonalPolaroidMemo(fallbacks[0]!, frames[0]!).valid, true);

  const memorialEn = { ...frames[0]!, status: "passed" as const };
  const memorialFallback = fallbackSeasonalPolaroidMemo(memorialEn);
  const memorialPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "passed", undefined, memorialEn.themeId, memorialEn.occasionId);
  assert.match(memorialFallback.lines[3]!, /bright day stays close/i);
  assert.match(memorialPrompt, /gentle birthday remembrance/i);
  assert.match(memorialPrompt, /without implying a present-day party or physical presence/i);
  assert.equal(validateSeasonalPolaroidMemo(memorialFallback, memorialEn).valid, true);

  const memorialKo = { ...memorialEn, locale: "ko" as const, petName: "Mochi" };
  const koreanPrompt = buildSeasonalPolaroidMemoSystemPrompt("ko", "passed", undefined, memorialKo.themeId, memorialKo.occasionId);
  const koreanFallback = fallbackSeasonalPolaroidMemo(memorialKo);
  assert.match(koreanPrompt, /나이, 생일 날짜, 사람, 선물, 촛불, 케이크/);
  assert.match(koreanFallback.lines[3]!, /기쁜 날의 온기가 기억에 남아/);
  assert.doesNotMatch(koreanFallback.lines.join(" "), /Halloween|pumpkin|vampire/i);
  assert.equal(validateSeasonalPolaroidMemo(koreanFallback, memorialKo).valid, true);
});

test("New Year prompts and four-line fallbacks are frame-independent, bilingual, hopeful, and non-Halloween", () => {
  const frames: SeasonalPolaroidPromptAnswers[] = [
    { themeId: "felt-doll", occasionId: "newyear-blessing", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
    { themeId: "gouache-story", occasionId: "newyear-blessing", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
    { themeId: "crayon-diary", occasionId: "newyear-blessing", locale: "en", petName: "Mochi", species: "cat", status: "living", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm", personalities: ["cuddle-bug"], habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window." },
  ];
  const imagePrompts = frames.map((answers) => buildSeasonalPolaroidImagePrompt(answers));
  const captionPrompts = frames.map((answers) => buildSeasonalPolaroidMemoSystemPrompt("en", "living", undefined, answers.themeId, answers.occasionId));
  const fallbacks = frames.map((answers) => fallbackSeasonalPolaroidMemo(answers));

  assert.equal(new Set(imagePrompts).size, 3);
  for (const prompt of imagePrompts) assert.match(prompt, /warm, hopeful New Year keepsake/i);
  assert.equal(captionPrompts[0], captionPrompts[1]);
  assert.equal(captionPrompts[1], captionPrompts[2]);
  assert.deepEqual(fallbacks[0], fallbacks[1]);
  assert.deepEqual(fallbacks[1], fallbacks[2]);
  assert.match(imagePrompts[0]!, /warm, hopeful New Year keepsake/i);
  assert.match(imagePrompts[0]!, /Do not depict a delivery event or invent people, places, dates/i);
  assert.match(captionPrompts[0]!, /warm, hopeful feeling of a fresh start/i);
  assert.match(captionPrompts[0]!, /Do not invent people, places, dates, real events, a delivery, resolutions, or personal memories/i);
  assert.match(captionPrompts[0]!, /Use only supplied pet details and personalTouch/i);
  assert.doesNotMatch(imagePrompts[0]!, /Halloween|pumpkin|vampire/i);
  assert.doesNotMatch(captionPrompts[0]!, /Halloween/i);
  assert.equal(fallbacks[0]!.lines.length, 4);
  assert.match(fallbacks[0]!.lines[3]!, /little hope brightens today/i);
  assert.equal(validateSeasonalPolaroidMemo(fallbacks[0]!, frames[0]!).valid, true);

  const memorialEn = { ...frames[0]!, status: "passed" as const };
  const memorialFallback = fallbackSeasonalPolaroidMemo(memorialEn);
  const memorialPrompt = buildSeasonalPolaroidMemoSystemPrompt("en", "passed", undefined, memorialEn.themeId, memorialEn.occasionId);
  assert.match(memorialFallback.lines[3]!, /warm wish stays with me/i);
  assert.match(memorialPrompt, /memorial pet, keep the tone gentle and peaceful/i);
  assert.equal(validateSeasonalPolaroidMemo(memorialFallback, memorialEn).valid, true);

  const memorialKo = { ...memorialEn, locale: "ko" as const };
  const koreanPrompt = buildSeasonalPolaroidMemoSystemPrompt("ko", "passed", undefined, memorialKo.themeId, memorialKo.occasionId);
  const koreanFallback = fallbackSeasonalPolaroidMemo(memorialKo);
  assert.match(koreanPrompt, /사람, 장소, 날짜, 실제 사건, 배달/);
  assert.match(koreanFallback.lines[3]!, /따뜻한 새해 마음이 남아/);
  assert.doesNotMatch(koreanFallback.lines.join(" "), /Halloween|pumpkin|vampire/i);
  assert.equal(validateSeasonalPolaroidMemo(koreanFallback, memorialKo).valid, true);
});

test("the four additional occasions stay frame-independent, personalized, bilingual, and fact-safe", () => {
  const frames = [
    { themeId: "felt-doll", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy" },
    { themeId: "gouache-story", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story" },
    { themeId: "crayon-diary", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm" },
  ];
  const occasions = [
    {
      id: "valentine-letter",
      imagePattern: /tender Valentine's keepsake/i,
      captionPattern: /Valentine context/i,
      captionPatternKo: /Valentine \uB9E5\uB77D/i,
    },
    {
      id: "spring-secret-garden",
      imagePattern: /quiet secret garden/i,
      captionPattern: /Spring garden context/i,
      captionPatternKo: /\uBD04 \uC815\uC6D0 \uB9E5\uB77D/i,
    },
    {
      id: "summer-seaside",
      imagePattern: /tiny, peaceful summer harbor/i,
      captionPattern: /Summer harbor context/i,
      captionPatternKo: /\uC5EC\uB984 \uD56D\uAD6C \uB9E5\uB77D/i,
    },
    {
      id: "halloween-mischief-ghost",
      imagePattern: /playful, gentle Halloween-mischief scene/i,
      captionPattern: /Mischief Ghost context/i,
      captionPatternKo: /\uC7A5\uB09C\uAFB8\uB7EC\uAE30 \uC720\uB839 \uB9E5\uB77D/i,
    },
  ];

  for (const occasion of occasions) {
    const promptPairs: Array<{ image: string; caption: string }> = [];
    for (const locale of ["en", "ko"] as const) {
      for (const status of ["living", "passed"] as const) {
        const answersForFrame = frames.map((frame): SeasonalPolaroidPromptAnswers => ({
          ...frame,
          occasionId: occasion.id,
          locale,
          petName: "Mochi",
          species: "cat",
          status,
          personalities: ["cuddle-bug"],
          habit: "sunbeam-napper",
          favoriteTreat: "tuna",
          callName: "mom",
          personalDetail: "Waits by the window.",
        }));
        const imagePrompts = answersForFrame.map((answers) => buildSeasonalPolaroidImagePrompt(answers));
        const captionPrompts = answersForFrame.map((answers) => buildSeasonalPolaroidMemoSystemPrompt(locale, status, undefined, answers.themeId, answers.occasionId));
        const fallbacks = answersForFrame.map((answers) => fallbackSeasonalPolaroidMemo(answers));
        assert.equal(new Set(imagePrompts).size, 3, `${occasion.id} must keep one distinct art medium per style`);
        for (const prompt of imagePrompts) {
          assert.match(prompt, occasion.imagePattern, `${occasion.id} occasion content must not depend on the art style`);
        }
        assert.equal(captionPrompts[0], captionPrompts[1], `${occasion.id} caption prompt must not depend on the frame`);
        assert.equal(captionPrompts[1], captionPrompts[2], `${occasion.id} caption prompt must not depend on the frame`);
        assert.deepEqual(fallbacks[0], fallbacks[1]);
        assert.deepEqual(fallbacks[1], fallbacks[2]);
        assert.match(imagePrompts[0]!, occasion.imagePattern);
        assert.match(imagePrompts[0]!, /Do not (?:add|invent|depict|imply)|Do not claim/i);
        assert.match(captionPrompts[0]!, locale === "en" ? occasion.captionPattern : occasion.captionPatternKo);
        assert.match(captionPrompts[0]!, /Do not invent|Do not claim/i);
        assert.equal(fallbacks[0]!.lines.length, 4);
        assert.equal(fallbacks[0]!.lines[0]!.includes("Mochi"), true);
        assert.equal(validateSeasonalPolaroidMemo(fallbacks[0]!, answersForFrame[0]!).valid, true);
        if (occasion.id !== "halloween-mischief-ghost") {
          assert.doesNotMatch(imagePrompts[0]!, /Halloween|pumpkin|vampire|ghost-sheet/i);
          assert.doesNotMatch(captionPrompts[0]!, /Halloween|pumpkin|vampire|ghost-sheet/i);
          assert.doesNotMatch(fallbacks[0]!.lines.join(" "), /Halloween|pumpkin|vampire/i);
        } else {
          assert.match(imagePrompts[0]!, /ghost is a scene companion, not a costume/i);
          assert.match(imagePrompts[0]!, /do not dress the pet in a ghost sheet/i);
          assert.doesNotMatch(imagePrompts[0]!, /COSTUME:|COSTUME FIT:/i);
          assert.doesNotMatch(captionPrompts[0]!, /happy Halloween/i);
          assert.doesNotMatch(fallbacks[0]!.lines.join(" "), /happy Halloween|pumpkin|vampire/i);
        }
        promptPairs.push({ image: imagePrompts[0]!, caption: captionPrompts[0]! });
      }
    }
    assert.equal(promptPairs.length, 4, `${occasion.id} should cover English/Korean and Living/Memorial`);
  }
});

test("Adoption Day prompts are frame-independent, bilingual, personalized, and non-Halloween", () => {
  const frames: SeasonalPolaroidPromptAnswers[] = [
    {
      themeId: "felt-doll", occasionId: "adoption-day", locale: "en", petName: "Mochi", species: "cat", status: "living",
      costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy", personalities: ["cuddle-bug"],
      habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window.",
    },
    {
      themeId: "gouache-story", occasionId: "adoption-day", locale: "en", petName: "Mochi", species: "cat", status: "living",
      costume: "picture-cape", scene: "meadow-path", vibe: "bright-story", personalities: ["cuddle-bug"],
      habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window.",
    },
    {
      themeId: "crayon-diary", occasionId: "adoption-day", locale: "en", petName: "Mochi", species: "cat", status: "living",
      costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm", personalities: ["cuddle-bug"],
      habit: "sunbeam-napper", favoriteTreat: "tuna", callName: "mom", personalDetail: "Waits by the window.",
    },
  ];
  const imagePrompts = frames.map((answers) => buildSeasonalPolaroidImagePrompt(answers));
  const captionPrompts = frames.map((answers) => buildSeasonalPolaroidMemoSystemPrompt(
    "en", "living", undefined, answers.themeId, answers.occasionId,
  ));
  const fallbacks = frames.map((answers) => fallbackSeasonalPolaroidMemo(answers));

  assert.equal(new Set(imagePrompts).size, 3);
  for (const prompt of imagePrompts) assert.match(prompt, /welcome-home keepsake/i);
  assert.equal(captionPrompts[0], captionPrompts[1]);
  assert.equal(captionPrompts[1], captionPrompts[2]);
  assert.deepEqual(fallbacks[0], fallbacks[1]);
  assert.deepEqual(fallbacks[1], fallbacks[2]);
  assert.match(imagePrompts[0]!, /welcome-home keepsake/i);
  assert.match(imagePrompts[0]!, /do not invent people/i);
  assert.doesNotMatch(imagePrompts[0]!, /Halloween|pumpkin|vampire/i);
  assert.match(captionPrompts[0]!, /Adoption Day context/i);
  assert.match(captionPrompts[0]!, /Do not invent people/i);
  assert.doesNotMatch(captionPrompts[0]!, /Halloween/i);
  assert.equal(buildSeasonalPolaroidCreativeBrief(frames[0]!).personalTouch, "Waits by the window.");
  assert.match(fallbacks[0]!.lines[3]!, /first day together/i);
  assert.doesNotMatch(fallbacks[0]!.lines.join(" "), /Halloween|pumpkin|vampire/i);
  assert.equal(validateSeasonalPolaroidMemo(fallbacks[0]!, frames[0]!).valid, true);

  const koreanAnswers = { ...frames[0]!, locale: "ko" as const, petName: "모찌", status: "passed" as const,
    costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy", personalDetail: "창가에서 기다리곤 했어." };
  const koreanCaption = buildSeasonalPolaroidMemoSystemPrompt("ko", "passed", undefined, koreanAnswers.themeId, koreanAnswers.occasionId);
  const koreanFallback = fallbackSeasonalPolaroidMemo(koreanAnswers);
  assert.match(koreanCaption, /입양 기념일 맥락/);
  assert.match(koreanCaption, /사람.*장소.*날짜/);
  assert.doesNotMatch(koreanCaption, /Halloween/i);
  assert.match(koreanFallback.lines[3]!, /처음 만난 날의 온기가 남아/);
  assert.doesNotMatch(koreanFallback.lines.join(" "), /할로윈|호박/);
  assert.equal(validateSeasonalPolaroidMemo(koreanFallback, koreanAnswers).valid, true);
});
