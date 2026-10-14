import assert from "node:assert/strict";
import test from "node:test";

import {
  isSeasonalPolaroidMemo,
  normalizeSeasonalPolaroidMemo,
  validateSeasonalPolaroidRequest,
  type SeasonalPolaroidQuestionnaire,
  type SeasonalPolaroidRequest,
} from "./seasonal-polaroid-contract.ts";

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
  secondaryPhoto?: File,
): SeasonalPolaroidRequest {
  return {
    answers: { ...BASE_ANSWERS, ...answers },
    primaryPhoto: photo(),
    ...(secondaryPhoto ? { secondaryPhoto } : {}),
  };
}

function issueFor(result: ReturnType<typeof validateSeasonalPolaroidRequest>, field: string) {
  assert.equal(result.valid, false);
  if (result.valid) throw new Error("expected invalid result");
  return result.issues.find((issue) => issue.field === field);
}

test("accepts a complete English living request with an optional second photo", () => {
  const result = validateSeasonalPolaroidRequest(request({}, photo("second.webp", "image/webp")));
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

test("requires the primary photo while allowing the secondary photo to be omitted", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request(),
    primaryPhoto: undefined as unknown as File,
  });
  assert.equal(issueFor(result, "primaryPhoto")?.code, "photo_required");
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
    callName: "custom",
    customCallName: "",
    personalDetail: "x".repeat(61),
  }));
  assert.equal(issueFor(result, "petName")?.code, "too_long");
  assert.equal(issueFor(result, "customTreat")?.code, "required");
  assert.equal(issueFor(result, "customCallName")?.code, "required");
  assert.equal(issueFor(result, "personalDetail")?.code, "too_long");
});

test("rejects unsupported theme, locale, and image formats", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request({ themeId: "christmas", locale: "ja" }),
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

test("enforces the 15 MB limit for both photos", () => {
  const result = validateSeasonalPolaroidRequest({
    ...request({}, photo("second.jpg", "image/jpeg", 15 * 1024 * 1024 + 1)),
    primaryPhoto: photo("pet.jpg", "image/jpeg", 15 * 1024 * 1024 + 1),
  });
  assert.equal(issueFor(result, "primaryPhoto")?.code, "photo_size");
  assert.equal(issueFor(result, "secondaryPhoto")?.code, "photo_size");
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
