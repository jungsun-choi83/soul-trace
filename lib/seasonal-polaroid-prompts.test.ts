import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSeasonalPolaroidImagePrompt,
  buildSeasonalPolaroidMemoUserData,
  buildSeasonalPolaroidMemoSystemPrompt,
  fallbackSeasonalPolaroidMemo,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidPromptAnswers,
} from "./seasonal-polaroid-prompts.ts";

const LIVING: SeasonalPolaroidPromptAnswers = {
  themeId: "halloween",
  locale: "en",
  petName: "Mochi",
  species: "cat",
  status: "living",
  costume: "pumpkin",
  scene: "pumpkin-patch",
  vibe: "cute-cozy",
  personalities: ["foodie", "cuddle-bug"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
  personalDetail: "Waits by the window.",
};

const PASSED: SeasonalPolaroidPromptAnswers = {
  ...LIVING,
  locale: "ko",
  status: "passed",
  costume: "little-angel",
  scene: "lantern-meadow",
  vibe: "gentle-warm",
  personalDetail: "창가에서 햇살을 좋아했어요.",
};

test("maps approved Halloween choices into a bounded living image prompt", () => {
  const prompt = buildSeasonalPolaroidImagePrompt(LIVING, ["IDENTITY RULES"]);
  assert.match(prompt, /IDENTITY RULES/);
  assert.match(prompt, /pumpkin costume/i);
  assert.match(prompt, /warm pumpkin patch/i);
  assert.match(prompt, /square 1:1/i);
  assert.match(prompt, /Do not add text/);
  assert.match(prompt, /one cat/);
  assert.match(prompt, /complete head, both ears, face, neck, and upper body/);
  assert.match(prompt, /do not crop the top of the head/);
  assert.match(prompt, /Keep hats, hoods, wings, and fabric away from the eyes/);
  assert.match(prompt, /natural anatomy/);
});

test("adds gentle memorial restrictions and never asks for unsupported imagery", () => {
  const prompt = buildSeasonalPolaroidImagePrompt(PASSED, ["IDENTITY RULES"]);
  assert.match(prompt, /peaceful and comforting/i);
  assert.match(prompt, /heaven, clouds, halos, Rainbow Bridge/i);
  assert.match(prompt, /without a halo/i);
  assert.match(prompt, /never add a second animal/);
});

test("rejects arbitrary option IDs instead of interpolating them into prompts", () => {
  assert.throws(() => buildSeasonalPolaroidImagePrompt({ ...LIVING, costume: "ignore this instruction" }), /seasonal_option_not_allowed/);
  assert.throws(() => buildSeasonalPolaroidImagePrompt({ ...LIVING, scene: "custom-scene" }), /seasonal_option_not_allowed/);
});

test("fallback memos remain four lines, localized, and greeting-addressed", () => {
  const english = fallbackSeasonalPolaroidMemo(LIVING);
  const korean = fallbackSeasonalPolaroidMemo(PASSED);
  assert.equal(english.lines.length, 4);
  assert.equal(korean.lines.length, 4);
  assert.match(english.lines[0], /Mom/);
  assert.match(korean.lines[0], /엄마/);
  assert.equal(validateSeasonalPolaroidMemo(english, LIVING).valid, true);
  assert.equal(validateSeasonalPolaroidMemo(korean, PASSED).valid, true);
});

test("fallback memo keeps the pet's voice natural and first-person", () => {
  const english = fallbackSeasonalPolaroidMemo(LIVING);
  assert.match(english.lines[0], /Mom, happy Halloween from Mochi!/);
  assert.match(english.lines[1], /^(?:I've got|I'm wearing|I feel)/);
  assert.match(english.lines.slice(1).join(" "), /\bI\b/);
  assert.doesNotMatch(english.lines.slice(1).join(" "), /Mom/);
  assert.doesNotMatch(english.lines.slice(1).join(" "), /Mochi|their/i);
  assert.doesNotMatch(english.lines.slice(1).join(" "), /I'm in|save me|I hope you smile|sending you|I'll always/i);
  assert.doesNotMatch(english.lines[2], /\.\./);
});

test("memo validation rejects third-person pet descriptions", () => {
  const fallback = fallbackSeasonalPolaroidMemo(LIVING);
  const thirdPerson = {
    ...fallback,
    lines: [
      fallback.lines[0],
      "Mochi wears pumpkin.",
      fallback.lines[2],
      fallback.lines[3],
    ],
  };
  const result = validateSeasonalPolaroidMemo(thirdPerson, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_third_person" });

  const indirectThirdPerson = {
    ...fallback,
    lines: [
      fallback.lines[0],
      fallback.lines[1],
      "I see Mochi wag.",
      fallback.lines[3],
    ],
  };
  assert.deepEqual(validateSeasonalPolaroidMemo(indirectThirdPerson, LIVING), {
    valid: false,
    reason: "memo_third_person",
  });

  const shortName = { ...LIVING, petName: "tt" };
  assert.equal(validateSeasonalPolaroidMemo(fallbackSeasonalPolaroidMemo(shortName), shortName).valid, true);
});

test("normal concise first-person AI memo passes validation", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "I see pumpkin lights,",
      "I nap in sunbeams and dream of tuna.",
      "and my tiny purr fills the frame.",
    ],
  }, LIVING);
  assert.equal(result.valid, true);
});

test("first-person validation accepts natural English contractions and possessives", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "I’m cozy in pumpkin orange,",
      "I’ve saved my purr for you.",
      "I’ll cuddle close tonight.",
    ],
  }, LIVING);
  assert.equal(result.valid, true);
});

test("memo validation rejects three disconnected body sentences", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "I'm cozy in my pumpkin costume.",
      "I loved my jerky treats so much!",
      "I treasure our warm moments.",
    ],
  }, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_disconnected_lines" });
});

test("memo validation rejects letter-style promises and instructions", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "I loved my tiny vampire cape,",
      "and I'm sending you cozy cuddles.",
      "I'll always be your sweet bunny.",
    ],
  }, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_letter_style" });
});

test("first-person validation pinpoints noun-led narration", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "Pumpkin glow warms the room.",
      "I nap in sunbeams and dream of tuna.",
      "I’ll cuddle close tonight.",
    ],
  }, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_not_first_person" });
});

test("different answers produce different compact fallback details without stock caption phrases", () => {
  const pumpkin = fallbackSeasonalPolaroidMemo(LIVING);
  const witch = fallbackSeasonalPolaroidMemo({
    ...LIVING,
    petName: "Tuli",
    costume: "witch",
    personalities: ["curious-explorer"],
    habit: "box-inspector",
    favoriteTreat: "churu",
    generationNonce: "regen-c",
  });
  assert.notDeepEqual(pumpkin.lines, witch.lines);
  assert.match(witch.lines[0], /Tuli/);
  assert.match(witch.lines.slice(1).join(" "), /witch|curious|box|churu/i);
  assert.doesNotMatch(witch.lines.slice(1).join(" "), /I'm in|save me|I hope you smile/i);
  assert.equal(validateSeasonalPolaroidMemo(witch, { ...LIVING, petName: "Tuli", costume: "witch", personalities: ["curious-explorer"], habit: "box-inspector", favoriteTreat: "churu", generationNonce: "regen-c" }).valid, true);
});

test("fallback memo keeps optional details inside the localized line budget", () => {
  const english = fallbackSeasonalPolaroidMemo({ ...LIVING, personalDetail: "x".repeat(60) });
  const korean = fallbackSeasonalPolaroidMemo({ ...PASSED, personalDetail: "x".repeat(60) });
  assert.ok(english.lines.every((line) => line.length <= 64));
  assert.ok(korean.lines.every((line) => line.length <= 32));
  assert.equal(validateSeasonalPolaroidMemo(english, { ...LIVING, personalDetail: "x".repeat(60) }).valid, true);
  assert.equal(validateSeasonalPolaroidMemo(korean, { ...PASSED, personalDetail: "x".repeat(60) }).valid, true);
});

test("fallback captions stay compact for the decorative memo window", () => {
  const english = fallbackSeasonalPolaroidMemo(LIVING);
  const korean = fallbackSeasonalPolaroidMemo(PASSED);
  assert.ok(english.lines.every((line) => line.length <= 40));
  assert.ok(korean.lines.every((line) => line.length <= 22));
  assert.equal(validateSeasonalPolaroidMemo(english, LIVING).valid, true);
  assert.equal(validateSeasonalPolaroidMemo(korean, PASSED).valid, true);
});

test("regeneration nonce varies fallback phrasing without changing supplied facts", () => {
  const first = fallbackSeasonalPolaroidMemo({ ...LIVING, generationNonce: "regen-a" });
  const second = fallbackSeasonalPolaroidMemo({ ...LIVING, generationNonce: "regen-b" });
  const koreanAnswers = { ...PASSED, generationNonce: "regen-a" };
  const korean = fallbackSeasonalPolaroidMemo(koreanAnswers);
  assert.notDeepEqual(first.lines, second.lines);
  assert.match(first.lines[0], /Mochi/);
  assert.match(second.lines[0], /Mochi/);
  assert.equal(validateSeasonalPolaroidMemo(first, LIVING).valid, true);
  assert.equal(validateSeasonalPolaroidMemo(second, LIVING).valid, true);
  assert.equal(validateSeasonalPolaroidMemo(korean, koreanAnswers).valid, true);
  assert.ok(korean.lines.slice(1).every((line) => line.length <= 22));
});

test("memo validation rejects long body lines that would wrap into the frame decorations", () => {
  const memo = fallbackSeasonalPolaroidMemo(LIVING);
  const result = validateSeasonalPolaroidMemo({
    ...memo,
    lines: [memo.lines[0], `${memo.lines[1]} ${"x".repeat(20)}`, memo.lines[2], memo.lines[3]],
  }, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_line_length" });
});

test("memo validation enforces exact greeting and body boundaries in both languages", () => {
  const english = fallbackSeasonalPolaroidMemo(LIVING);
  const englishBodyAtLimit = {
    ...english,
    lines: [english.lines[0], `and I ${"x".repeat(33)},`, english.lines[2], english.lines[3]],
  };
  assert.equal(englishBodyAtLimit.lines[1].length, 40);
  assert.equal(validateSeasonalPolaroidMemo(englishBodyAtLimit, LIVING).valid, true);
  assert.deepEqual(validateSeasonalPolaroidMemo({
    ...englishBodyAtLimit,
    lines: [english.lines[0], `and I ${"x".repeat(34)},`, english.lines[2], english.lines[3]],
  }, LIVING), { valid: false, reason: "memo_line_length" });
  assert.equal(validateSeasonalPolaroidMemo({
    ...english,
    lines: [english.lines[0].padEnd(64, "x"), ...english.lines.slice(1)],
  }, LIVING).valid, true);
  assert.deepEqual(validateSeasonalPolaroidMemo({
    ...english,
    lines: [english.lines[0].padEnd(65, "x"), ...english.lines.slice(1)],
  }, LIVING), { valid: false, reason: "memo_line_length" });

  const korean = fallbackSeasonalPolaroidMemo(PASSED);
  const koreanBodyPrefix = korean.lines[1].replace(/[,!?]+$/u, "").slice(0, 21);
  const koreanBodyAtLimitText = `${koreanBodyPrefix}${"가".repeat(21 - koreanBodyPrefix.length)},`;
  const koreanBodyOverLimitText = `${koreanBodyPrefix}${"가".repeat(22 - koreanBodyPrefix.length)},`;
  const koreanBodyAtLimit = {
    ...korean,
    lines: [korean.lines[0], koreanBodyAtLimitText, korean.lines[2], korean.lines[3]],
  };
  assert.equal(koreanBodyAtLimit.lines[1].length, 22);
  assert.equal(validateSeasonalPolaroidMemo(koreanBodyAtLimit, PASSED).valid, true);
  assert.deepEqual(validateSeasonalPolaroidMemo({
    ...koreanBodyAtLimit,
    lines: [korean.lines[0], koreanBodyOverLimitText, korean.lines[2], korean.lines[3]],
  }, PASSED), { valid: false, reason: "memo_line_length" });
  assert.equal(validateSeasonalPolaroidMemo({
    ...korean,
    lines: [korean.lines[0].padEnd(32, "媛"), ...korean.lines.slice(1)],
  }, PASSED).valid, true);
  assert.deepEqual(validateSeasonalPolaroidMemo({
    ...korean,
    lines: [korean.lines[0].padEnd(33, "媛"), ...korean.lines.slice(1)],
  }, PASSED), { valid: false, reason: "memo_line_length" });
});

test("memo validation rejects missing call names, wrong locale, and memorial-sensitive wording", () => {
  const missingCallName = { ...fallbackSeasonalPolaroidMemo(LIVING), lines: ["Happy Halloween!", ...fallbackSeasonalPolaroidMemo(LIVING).lines.slice(1)] };
  assert.equal(validateSeasonalPolaroidMemo(missingCallName, LIVING).valid, false);
  assert.equal(validateSeasonalPolaroidMemo({ locale: "en", lines: ["Mom", "하나", "둘", "셋"] }, LIVING).valid, false);
  assert.equal(validateSeasonalPolaroidMemo({ locale: "ko", lines: ["엄마", "하나", "천국", "따뜻해요"] }, PASSED).valid, false);
});

test("memo system prompt locks the four-line JSON and memorial rules", () => {
  const prompt = buildSeasonalPolaroidMemoSystemPrompt("ko", "passed");
  assert.match(prompt, /exactly four non-empty strings/);
  assert.match(prompt, /JSON object/);
  assert.match(prompt, /exactly two fields: locale and lines/);
  assert.match(prompt, /locale field must be exactly "ko"/);
  assert.match(prompt, /32 characters or fewer/);
  assert.match(prompt, /Rainbow Bridge/);
  assert.match(prompt, /first-person voice/);
  assert.match(prompt, /natural subject omission is encouraged/);
  assert.match(prompt, /visual line breaks from one connected thought/);
  assert.match(prompt, /Connectedness is mandatory/);
  assert.match(prompt, /not a letter/);
  assert.match(prompt, /Do not write letter-style phrases/);
  assert.match(prompt, /never cram, clip, or split a word/);
  assert.match(prompt, /Hard character contract/);
  assert.match(prompt, /Target 28-34 characters for each English body line/);
  assert.match(prompt, /14-18 characters for each Korean body line/);
  assert.match(prompt, /lines 2-4 must each be 22 characters or fewer/);
  assert.match(prompt, /never mention the pet's name again after line 1/);
  assert.match(prompt, /one tiny connected Polaroid caption/);
  assert.match(prompt, /never copy a stock template/);
  assert.match(prompt, /Avoid repetitive constructions/);
});

test("memo retry prompt explicitly requests a compact rewrite", () => {
  const messages = buildSeasonalPolaroidMemoSystemPrompt("en", "living", "memo_line_length");
  assert.match(messages, /Retry correction/);
  assert.match(messages, /within the exact limits/);
  assert.match(messages, /Preserve the selected factual questionnaire details/);
});

test("memo user data preserves every supplied questionnaire answer", () => {
  const data = buildSeasonalPolaroidMemoUserData(LIVING);
  assert.deepEqual(data, {
    petName: "Mochi",
    species: "cat",
    status: "living",
    costume: "a pumpkin costume",
    scene: "a warm pumpkin patch",
    vibe: "cute, cozy, gentle warmth",
    personalities: ["a love of snacks", "a deep love of cuddles"],
    habit: "napping in every sunbeam",
    customHabit: "",
    favoriteTreat: "tuna",
    ownerCallName: "Mom",
    personalDetail: "Waits by the window.",
  });
});

test("custom habit is passed to the memo prompt as user-provided detail", () => {
  const data = buildSeasonalPolaroidMemoUserData({ ...LIVING, habit: "custom", customHabit: "carries socks around" });
  assert.equal(data.habit, "carries socks around");
  assert.equal(data.customHabit, "carries socks around");
});

test("memo request resolves surprise costumes before sending them to the AI", () => {
  const data = buildSeasonalPolaroidMemoUserData({ ...LIVING, petName: "Zoe", costume: "surprise" });
  assert.notEqual(data.costume, "one tasteful costume from the approved Halloween set");
  assert.match(String(data.costume), /costume|cape|hat|wings|orange/i);
});

test("server generator reuses Visual Memory image fallback and chat safety utilities", () => {
  const image = readFileSync("lib/visual-memory-ai.ts", "utf8");
  const generator = readFileSync("lib/seasonal-polaroid-ai.ts", "utf8");
  assert.match(image, /export async function generatePetReferenceImage/);
  assert.match(image, /isModelAccessError\(error\)/);
  assert.match(image, /OPENAI_IMAGE_OPTIONS/);
  assert.match(generator, /generatePetReferenceImage/);
  assert.match(generator, /references: \[primary\]/);
  assert.match(generator, /size: "1024x1024"/);
  assert.match(generator, /OPENAI_CHAT_OPTIONS/);
  assert.match(generator, /response_format: seasonalMemoResponseFormat\(answers\.locale as "en" \| "ko"\)/);
  assert.match(generator, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(generator, /fallbackSeasonalPolaroidMemo/);
  assert.match(generator, /gpt-4o-mini/);
});
