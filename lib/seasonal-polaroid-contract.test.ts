import assert from "node:assert/strict";
import test from "node:test";

import {
  isSeasonalPolaroidMemo,
  normalizeSeasonalPolaroidMemo,
  validateSeasonalPolaroidRequest,
  type SeasonalPolaroidQuestionnaire,
  type SeasonalPolaroidRequest,
} from "./seasonal-polaroid-contract.ts";
import { HALLOWEEN_POLAROID_THEME } from "./seasonal-polaroid.ts";

function photo(name = "pet.jpg", type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

const BASE_ANSWERS: SeasonalPolaroidQuestionnaire = {
  themeId: "halloween",
  locale: "en",
  petName: "Mochi",
  species: "cat",
  status: "living",
  costume: "pumpkin",
  scene: "pumpkin-patch",
  vibe: "cute-cozy",
  personalities: ["foodie"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
  personalDetail: "Always waits by the window.",
};

function request(
  answers: Partial<SeasonalPolaroidQuestionnaire> = {},
): SeasonalPolaroidRequest {
  return {
    answers: { ...BASE_ANSWERS, ...answers },
    primaryPhoto: photo(),
  };
}

function issueFor(result: ReturnType<typeof validateSeasonalPolaroidRequest>, field: string) {
  assert.equal(result.valid, false);
  if (result.valid) throw new Error("expected invalid result");
  return result.issues.find((issue) => issue.field === field);
}

test("accepts a complete English living request with one primary photo", () => {
  const result = validateSeasonalPolaroidRequest(request({}));
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.answers.locale, "en");
    assert.equal(result.answers.status, "living");
    assert.equal(result.theme.id, "halloween");
  }
});

test("accepts a complete Korean passed request with memorial-only options", () => {
  const result = validateSeasonalPolaroidRequest(request({
    locale: "ko",
    status: "passed",
    costume: "little-angel",
    scene: "lantern-meadow",
    vibe: "gentle-warm",
  }));
  assert.equal(result.valid, true);
});

test("accepts a custom habit only when the user supplies its description", () => {
  const accepted = validateSeasonalPolaroidRequest(request({ habit: "custom", customHabit: "carries socks around" }));
  assert.equal(accepted.valid, true);
  const missing = validateSeasonalPolaroidRequest(request({ habit: "custom", customHabit: "" }));
  assert.equal(issueFor(missing, "customHabit")?.code, "required");
});

test("rejects missing required answers", () => {
  const result = validateSeasonalPolaroidRequest(request({
    petName: "",
    species: "",
    status: "",
    costume: "",
    scene: "",
    vibe: "",
    personalities: [],
    habit: "",
    favoriteTreat: "",
    callName: "",
  }));
  assert.equal(issueFor(result, "petName")?.code, "required");
  assert.equal(issueFor(result, "species")?.code, "unsupported");
  assert.equal(issueFor(result, "status")?.code, "unsupported");
  assert.equal(issueFor(result, "personalities")?.code, "required");
  assert.equal(issueFor(result, "primaryPhoto"), undefined);
});

test("requires the primary photo and ignores any extra photo field", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request(),
    primaryPhoto: undefined as unknown as File,
  });
  assert.equal(issueFor(result, "primaryPhoto")?.code, "photo_required");
  // A stale client that still sends a second file does not change the outcome.
  const withExtra = validateSeasonalPolaroidRequest({ ...request(), secondaryPhoto: photo("second.webp", "image/webp") } as SeasonalPolaroidRequest);
  assert.equal(withExtra.valid, true);
  assert.equal(JSON.stringify(withExtra).includes("secondaryPhoto"), false);
});

test("the retired 'Something else' call name is read as 'A name' with the typed name", () => {
  const legacy = validateSeasonalPolaroidRequest(request({ callName: "custom", customCallName: "Grandma" }));
  assert.equal(legacy.valid, true);
  if (legacy.valid) {
    assert.equal(legacy.answers.callName, "by-name");
    assert.equal(legacy.answers.customCallName, "Grandma");
  }
  const legacyMissingName = validateSeasonalPolaroidRequest(request({ callName: "custom", customCallName: "" }));
  assert.equal(issueFor(legacyMissingName, "customCallName")?.code, "required");
  // It is no longer a selectable option.
  assert.equal(HALLOWEEN_POLAROID_THEME.callNames.some((option) => option.id === "custom"), false);
  assert.deepEqual(HALLOWEEN_POLAROID_THEME.callNames.map((option) => option.id), ["mom", "dad", "both", "sister", "brother", "by-name"]);
});

test("rejects living and passed option combinations that are restricted by the theme", () => {
  const living = validateSeasonalPolaroidRequest(request({
    costume: "little-angel",
    scene: "lantern-meadow",
    vibe: "gentle-warm",
  }));
  assert.equal(issueFor(living, "costume")?.code, "restricted");
  assert.equal(issueFor(living, "scene")?.code, "restricted");
  assert.equal(issueFor(living, "vibe")?.code, "restricted");

  const passed = validateSeasonalPolaroidRequest(request({
    status: "passed",
    costume: "ghost-sheet",
    scene: "haunted-porch",
    vibe: "spooky-cool",
  }));
  assert.equal(issueFor(passed, "costume")?.code, "restricted");
  assert.equal(issueFor(passed, "scene")?.code, "restricted");
  assert.equal(issueFor(passed, "vibe")?.code, "restricted");
});

test("enforces species-dependent habits and treats", () => {
  const result = validateSeasonalPolaroidRequest(request({
    habit: "binky",
    favoriteTreat: "carrot",
  }));
  assert.equal(issueFor(result, "habit")?.code, "unsupported");
  assert.equal(issueFor(result, "favoriteTreat")?.code, "unsupported");
});

test("limits personality selections and rejects duplicates", () => {
  const tooMany = validateSeasonalPolaroidRequest(request({ personalities: ["foodie", "drama", "sleepyhead"] }));
  assert.equal(issueFor(tooMany, "personalities")?.code, "too_many");

  const duplicate = validateSeasonalPolaroidRequest(request({ personalities: ["foodie", "foodie"] }));
  assert.equal(issueFor(duplicate, "personalities")?.code, "duplicate");
});

test("enforces text length limits and custom field requirements", () => {
  const result = validateSeasonalPolaroidRequest(request({
    petName: "This name is too long",
    favoriteTreat: "custom",
    customTreat: "",
    callName: "by-name",
    customCallName: "",
    personalDetail: "x".repeat(61),
  }));
  assert.equal(issueFor(result, "petName")?.code, "too_long");
  assert.equal(issueFor(result, "customTreat")?.code, "required");
  assert.equal(issueFor(result, "customCallName")?.code, "required");
  assert.equal(issueFor(result, "personalDetail")?.code, "too_long");
});

test("accepts a year-round felt-doll request with matching props", () => {
  const result = validateSeasonalPolaroidRequest(request({
    themeId: "felt-doll",
    costume: "knit-scarf",
    scene: "tiny-armchair",
    vibe: "cute-cozy",
  }));
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.theme.id, "felt-doll");
});

test("accepts an art style plus an implemented special-day occasion", () => {
  const result = validateSeasonalPolaroidRequest(request({
    themeId: "gouache-story",
    occasionId: "halloween",
    costume: "pumpkin",
    scene: "pumpkin-patch",
    vibe: "cute-cozy",
  }));
  assert.equal(result.valid, true);
  if (result.valid) {
    assert.equal(result.theme.id, "gouache-story");
    assert.equal(result.answers.occasionId, "halloween");
  }
});

test("rejects an unknown special-day occasion", () => {
  const result = validateSeasonalPolaroidRequest(request({
    themeId: "felt-doll",
    occasionId: "unknown-holiday",
    costume: "knit-scarf",
    scene: "tiny-armchair",
    vibe: "cute-cozy",
  }));
  assert.equal(issueFor(result, "occasionId")?.code, "unsupported");
});

test("accepts Adoption Day with each supported decorative frame", () => {
  const styles = [
    { themeId: "felt-doll", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy" },
    { themeId: "gouache-story", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story" },
    { themeId: "crayon-diary", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm" },
  ];
  for (const style of styles) {
    const result = validateSeasonalPolaroidRequest(request({ ...style, occasionId: "adoption-day" }));
    assert.equal(result.valid, true, `${style.themeId} should accept Adoption Day`);
    if (result.valid) assert.equal(result.answers.occasionId, "adoption-day");
  }
});

test("accepts Birthday with all decorative frames", () => {
  const styles = [
    { themeId: "felt-doll", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy" },
    { themeId: "gouache-story", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story" },
    { themeId: "crayon-diary", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm" },
  ];
  for (const style of styles) {
    const result = validateSeasonalPolaroidRequest(request({ ...style, occasionId: "birthday-star" }));
    assert.equal(result.valid, true, `${style.themeId} should accept Birthday`);
    if (result.valid) assert.equal(result.answers.occasionId, "birthday-star");
  }
});

test("accepts New Year with all decorative frames", () => {
  const styles = [
    { themeId: "felt-doll", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy" },
    { themeId: "gouache-story", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story" },
    { themeId: "crayon-diary", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm" },
  ];
  for (const style of styles) {
    const result = validateSeasonalPolaroidRequest(request({ ...style, occasionId: "newyear-blessing" }));
    assert.equal(result.valid, true, `${style.themeId} should accept New Year`);
    if (result.valid) assert.equal(result.answers.occasionId, "newyear-blessing");
  }
});

test("accepts the four newly implemented occasions with all decorative frames", () => {
  const stylesByStatus = {
    living: [
      { themeId: "felt-doll", costume: "knit-scarf", scene: "tiny-armchair", vibe: "cute-cozy" },
      { themeId: "gouache-story", costume: "picture-cape", scene: "meadow-path", vibe: "bright-story" },
      { themeId: "crayon-diary", costume: "crayon-bow", scene: "diary-page", vibe: "handmade-warm" },
    ],
    passed: [
      { themeId: "felt-doll", costume: "knit-scarf", scene: "quiet-shelf", vibe: "gentle-warm" },
      { themeId: "gouache-story", costume: "picture-cape", scene: "star-hill", vibe: "gentle-warm" },
      { themeId: "crayon-diary", costume: "crayon-bow", scene: "quiet-margin", vibe: "gentle-warm" },
    ],
  } as const;
  const occasionIds = ["valentine-letter", "spring-secret-garden", "summer-seaside", "halloween-mischief-ghost"];
  for (const occasionId of occasionIds) {
    for (const status of ["living", "passed"] as const) {
      for (const style of stylesByStatus[status]) {
        const result = validateSeasonalPolaroidRequest(request({ ...style, status, occasionId }));
        assert.equal(result.valid, true, `${occasionId} should accept ${status} ${style.themeId}`);
        if (result.valid) assert.equal(result.answers.occasionId, occasionId);
      }
    }
  }
});

test("rejects unsupported theme, locale, and image formats", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request({ themeId: "unknown-theme", locale: "ja" }),
    primaryPhoto: photo("pet.heic", "image/heic"),
  });
  assert.equal(issueFor(result, "themeId")?.code, "unsupported");
  assert.equal(issueFor(result, "locale")?.code, "unsupported");
  assert.equal(issueFor(result, "primaryPhoto")?.code, "photo_heic");

  const unsupported = validateSeasonalPolaroidRequest({
    ...request(),
    primaryPhoto: photo("pet.gif", "image/gif"),
  });
  assert.equal(issueFor(unsupported, "primaryPhoto")?.code, "photo_type");
});

test("enforces the 15 MB limit for the photo", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request(),
    primaryPhoto: photo("pet.jpg", "image/jpeg", 15 * 1024 * 1024 + 1),
    answers: { ...BASE_ANSWERS },
  });
  assert.equal(issueFor(result, "primaryPhoto")?.code, "photo_size");
});

test("validates exactly four memo lines and preserves locale", () => {
  assert.equal(isSeasonalPolaroidMemo({ locale: "en", lines: ["one", "two", "three", "four"] }), true);
  assert.equal(isSeasonalPolaroidMemo({ locale: "ko", lines: ["하나", "둘", "셋", "넷"] }), true);
  assert.equal(isSeasonalPolaroidMemo({ locale: "en", lines: ["one", "two", "three"] }), false);
  assert.equal(isSeasonalPolaroidMemo({ locale: "en", lines: ["one", "two", "three", ""] }), false);
  assert.deepEqual(normalizeSeasonalPolaroidMemo({ locale: "ko", lines: [" 하나 ", "둘", "셋", "넷"] }), {
    locale: "ko",
    lines: ["하나", "둘", "셋", "넷"],
  });
});
