import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildSeasonalPolaroidCreativeBrief,
  buildSeasonalPolaroidImagePrompt,
  buildSeasonalPolaroidMemoMessages,
  buildSeasonalPolaroidMemoUserData,
  buildSeasonalPolaroidMemoSystemPrompt,
  buildSeasonalPolaroidMemoVisionMessages,
  fallbackSeasonalPolaroidMemo,
  resolveSeasonalPolaroidCostume,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidPromptAnswers,
} from "./seasonal-polaroid-prompts.ts";
import { HALLOWEEN_POLAROID_THEME, optionsForStatus, type PolaroidSpecies, type PolaroidStatus } from "./seasonal-polaroid.ts";

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
  assert.match(prompt, /hard maximum of 22 characters/);
  assert.match(prompt, /Rainbow Bridge/);
  assert.match(prompt, /first-person voice/);
  assert.match(prompt, /Subject omission is natural/);
  assert.match(prompt, /not a letter/);
  assert.match(prompt, /do not repeat the pet's name after line 1/);
  assert.match(prompt, /The photo is the moment/);
  assert.match(prompt, /do not mention objects that are not in the photo/);
  assert.match(prompt, /personalTouch/);
  assert.match(prompt, /It is NOT in the photo/);
  assert.match(prompt, /Leaving both out is fine/);
  assert.match(prompt, /Never add a second personal fact/);
  assert.match(prompt, /aim for 14-18 characters/);
  assert.match(prompt, /Shape example/);
  assert.match(prompt, /never split a sentence awkwardly/);
  assert.doesNotMatch(prompt, /memoryFocus|creative direction|Build the caption around/);
  assert.doesNotMatch(prompt, /Connectedness is mandatory/);
  assert.doesNotMatch(prompt, /Prioritize details in this order/);

  const living = buildSeasonalPolaroidMemoSystemPrompt("en", "living");
  assert.match(living, /Line 2 must speak as the pet/);
  assert.match(living, /hard maximum of 40 characters/);
  assert.match(living, /aim for 28-34 characters, about six to eight words/);
  // The English shape example obeys the validator it is teaching.
  const example = JSON.parse(living.match(/Shape example \(do not copy the words\): (\[.*\])/)![1]!) as string[];
  assert.equal(validateSeasonalPolaroidMemo({ locale: "en", lines: example }, { ...LIVING, petName: "Tuli" }).valid, true);
  assert.ok(example.slice(1).every((line) => line.length >= 28 && line.length <= 34), JSON.stringify(example.map((l) => l.length)));
  assert.match(living, /Living tone/);
  assert.doesNotMatch(living, /Rainbow Bridge/);
  // The original prompt was ~3,700 characters; the shape example is worth its ~250.
  assert.ok(living.length < 2800, `prompt should stay compact, got ${living.length} chars`);
});

test("creative brief carries identity, voice, an optional owner touch, and off-camera background", () => {
  const withDetail = buildSeasonalPolaroidCreativeBrief(LIVING);
  assert.deepEqual(withDetail, {
    petName: "Mochi",
    species: "cat",
    status: "living",
    ownerCallName: "Mom",
    personality: "a love of snacks",
    personalTouch: "Waits by the window.",
    background: { kind: "habit", text: "napping in every sunbeam" },
  });
  const withoutDetail = buildSeasonalPolaroidCreativeBrief({ ...LIVING, personalDetail: "" });
  assert.equal("personalTouch" in withoutDetail, false, "no owner detail means no personalTouch field at all");
  assert.deepEqual(withoutDetail.background, { kind: "habit", text: "napping in every sunbeam" });
  const regenerated = buildSeasonalPolaroidCreativeBrief({ ...LIVING, personalDetail: "", generationNonce: "y" });
  assert.deepEqual(regenerated.background, { kind: "treat", text: "tuna" });
  const payload = JSON.parse(buildSeasonalPolaroidMemoMessages(LIVING)[1]!.content) as { instruction: string; brief: unknown };
  assert.match(payload.instruction, /factual input only/);
  assert.deepEqual(payload.brief, withDetail);
});

test("Church regression: a doorway habit is sent as off-camera background, never as a visible detail", () => {
  const church: SeasonalPolaroidPromptAnswers = {
    ...LIVING,
    petName: "Church",
    species: "dog",
    costume: "witch",
    scene: "pumpkin-patch",
    personalities: ["little-boss"],
    habit: "doorway-watcher",
    favoriteTreat: "jerky",
    personalDetail: "",
  };
  const brief = buildSeasonalPolaroidCreativeBrief(church);
  assert.equal("personalTouch" in brief, false);
  assert.deepEqual(brief.background, { kind: "habit", text: "keeping watch by the door" });
  const text = JSON.stringify(brief);
  assert.doesNotMatch(text, /jerky|witch|pumpkin/i);
  const system = buildSeasonalPolaroidMemoSystemPrompt("en", "living");
  assert.match(system, /background is what this pet is known for off camera/);
  assert.match(system, /never show it happening in the picture/);
  assert.match(system, /The photo is the moment/);
});

test("Choke regression: the caption request never carries a second detail or the look", () => {
  const choke: SeasonalPolaroidPromptAnswers = {
    ...LIVING,
    petName: "Choke",
    species: "dog",
    costume: "pumpkin",
    scene: "moonlit-forest",
    vibe: "cute-cozy",
    personalities: ["foodie"],
    habit: "toy-carrier",
    favoriteTreat: "cheese",
    personalDetail: "",
  };
  const text = buildSeasonalPolaroidMemoVisionMessages(choke, { base64: "QUJD", mimeType: "image/jpeg" })[1]!.content;
  const userText = (text as Array<{ type: string; text?: string }>)[0]!.text!;
  // The habit is the single touch for a first generation; cheese, the costume
  // and the scene must not be offered to the model at all.
  assert.match(userText, /carrying a favorite toy/);
  assert.doesNotMatch(userText, /cheese|pumpkin|forest|moonlit|cozy/i);
  const system = buildSeasonalPolaroidMemoSystemPrompt("en", "living");
  assert.match(system, /do not mention objects that are not in the photo/);
  // The questionnaire answers still drive the image prompt in full.
  const image = buildSeasonalPolaroidImagePrompt(choke);
  assert.match(image, /pumpkin costume/);
  assert.match(image, /moonlit forest/);
  assert.match(image, /love of snacks/);
});

test("creative brief is localized and the personal touch follows the same selection in Korean", () => {
  const korean = buildSeasonalPolaroidCreativeBrief({ ...PASSED, personalDetail: "" });
  assert.deepEqual(korean, {
    petName: "Mochi",
    species: "고양이",
    status: "passed",
    ownerCallName: "엄마",
    personality: "간식을 사랑하는 마음",
    background: { kind: "habit", text: "햇살 아래 낮잠을 자는 모습" },
  });
  const koreanPrompt = buildSeasonalPolaroidMemoSystemPrompt("ko", "living");
  const example = JSON.parse(koreanPrompt.match(/Shape example \(do not copy the words\): (\[.*\])/)![1]!) as string[];
  assert.equal(validateSeasonalPolaroidMemo({ locale: "ko", lines: example }, { ...LIVING, locale: "ko", petName: "뚜리" }).valid, true);
  assert.ok(example.slice(1).every((line) => line.length <= 18), JSON.stringify(example.map((l) => l.length)));
  const withDetail = buildSeasonalPolaroidCreativeBrief(PASSED);
  assert.equal(withDetail.personalTouch, "창가에서 햇살을 좋아했어요.");
  const prompt = buildSeasonalPolaroidMemoSystemPrompt("ko", "passed");
  assert.match(prompt, /Memorial tone/);
  assert.match(prompt, /natural conversational Korean/);
});

test("vision messages carry the same brief plus the generated photo at low detail", () => {
  const messages = buildSeasonalPolaroidMemoVisionMessages(LIVING, { base64: "QUJD", mimeType: "image/jpeg" });
  assert.equal(messages.length, 2);
  assert.equal(messages[0]!.role, "system");
  const user = messages[1]!;
  assert.equal(user.role, "user");
  assert.ok(Array.isArray(user.content));
  const [text, image] = user.content as Array<Record<string, unknown>>;
  assert.equal(text!.type, "text");
  assert.equal(text!.text, buildSeasonalPolaroidMemoMessages(LIVING)[1]!.content);
  assert.deepEqual(image, { type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD", detail: "low" } });
});

test("memo validation rejects captions that give the owner instructions", () => {
  const result = validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [
      "Mom, happy Halloween from Mochi!",
      "I'm cozy in my pumpkin costume,",
      "and my tuna dreams feel warm tonight.",
      "Hold me near and keep smiling with me.",
    ],
  }, LIVING);
  assert.deepEqual(result, { valid: false, reason: "memo_owner_instruction" });
  const korean = validateSeasonalPolaroidMemo({
    locale: "ko",
    lines: ["엄마, 모찌야! 해피 할로윈!", "호박 옷 입고,", "참치 간식이 제일 좋아.", "나를 꼭 안아줘."],
  }, { ...PASSED, status: "living", costume: "pumpkin", scene: "pumpkin-patch", vibe: "cute-cozy", petName: "모찌" });
  assert.deepEqual(korean, { valid: false, reason: "memo_owner_instruction" });
  // Participles and ordinary first-person lines are untouched.
  assert.equal(validateSeasonalPolaroidMemo({
    locale: "en",
    lines: ["Mom, happy Halloween from Mochi!", "I'm keeping my pumpkin hat on,", "and still dreaming of tuna.", "This tiny moment feels like home."],
  }, LIVING).valid, true);
});

test("the observed Juju caption is rejected for every rule it breaks", () => {
  const juju: SeasonalPolaroidPromptAnswers = {
    ...LIVING,
    petName: "Juju",
    species: "dog",
    costume: "skeleton",
    scene: "trick-or-treat-street",
    personalities: ["cuddle-bug"],
    habit: "toy-carrier",
    favoriteTreat: "cheese",
    personalDetail: "",
  };
  const observed = [
    "Mom, I'm your little skeleton tonight.",
    "I'm glowing down this cozy trick-or-treat street.",
    "My favorite toy stays close while I look for cheese.",
    "Hold me near and keep smiling with me.",
  ];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: observed }, juju), { valid: false, reason: "memo_line_length" });
  const shortened = ["Mom, happy Halloween from Juju!", "I'm trotting down the street,", "my toy close as I sniff for cheese.", observed[3]!];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: shortened }, juju), { valid: false, reason: "memo_owner_instruction" });
  const disconnected = [shortened[0]!, "I'm trotting down the street.", "My toy stays close by.", "This is one little Halloween moment."];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: disconnected }, juju), { valid: false, reason: "memo_disconnected_lines" });
});

test("surprise costumes that resolve to little-angel are allowed to name it in a memorial memo", () => {
  const angelName = ["Milo", "Lucy", "Chloe", "Luna", "Bella", "Coco"].find((name) =>
    resolveSeasonalPolaroidCostume({ ...PASSED, petName: name, costume: "surprise" }) === "little-angel");
  assert.ok(angelName, "expected a name whose surprise costume resolves to little-angel");
  const answers: SeasonalPolaroidPromptAnswers = { ...PASSED, locale: "en", petName: angelName!, costume: "surprise", personalDetail: "" };
  for (const nonce of [undefined, "y", "z"]) {
    const withNonce = { ...answers, generationNonce: nonce };
    const memo = fallbackSeasonalPolaroidMemo(withNonce);
    assert.deepEqual(validateSeasonalPolaroidMemo(memo, withNonce), { valid: true, memo });
  }
  assert.equal(validateSeasonalPolaroidMemo({
    locale: "en",
    lines: [`Mom, happy Halloween from ${angelName}!`, "I'm in my little angel costume,", "soft wings and a warm lantern glow", "one gentle Halloween moment."],
  }, answers).valid, true);
});

test("fallback scene phrases are complete sentences, never clipped fragments", () => {
  for (const status of ["living", "passed"] as const) {
    for (const scene of optionsForStatus(HALLOWEEN_POLAROID_THEME.scenes, status)) {
      const answers: SeasonalPolaroidPromptAnswers = { ...LIVING, status, scene: scene.id, vibe: status === "passed" ? "gentle-warm" : "cute-cozy", costume: "pumpkin", personalDetail: "" };
      const line = fallbackSeasonalPolaroidMemo(answers).lines[2];
      assert.doesNotMatch(line, /\b(?:the|a|in|on|of|filled|moonlit|lantern-lit)\.$/i, `${status}/${scene.id}: ${line}`);
      assert.ok(line.length <= 40, `${status}/${scene.id}: ${line}`);
    }
  }
});

test("every supported fallback combination passes its own validator", () => {
  const theme = HALLOWEEN_POLAROID_THEME;
  const species: PolaroidSpecies[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];
  const statuses: PolaroidStatus[] = ["living", "passed"];
  const callNames = [
    { callName: "mom" },
    { callName: "both" },
    { callName: "by-name", customCallName: "G".repeat(40) },
  ];
  const petNames = { en: ["Juju", "Maximiliano1"], ko: ["주주", "뚜리뚜리뚜리뚜리뚜리뚜리"] } as const;
  // The three fallback variations use different answer fields, so each one is
  // swept over the fields it actually reads. Nonces "", "y", "z" map to
  // variations 0, 1, 2.
  const variations: Array<{ nonce: string | undefined; scenes: boolean; personalities: boolean }> = [
    { nonce: undefined, scenes: true, personalities: false },
    { nonce: "y", scenes: false, personalities: false },
    { nonce: "z", scenes: false, personalities: true },
  ];
  let checked = 0;
  for (const locale of ["en", "ko"] as const) for (const status of statuses) for (const kind of species)
  for (const costume of optionsForStatus(theme.costumes, status)) for (const habit of theme.habitsBySpecies[kind])
  for (const treat of theme.treatsBySpecies[kind]) for (const owner of callNames) for (const petName of petNames[locale])
  for (const variation of variations)
  for (const scene of variation.scenes ? optionsForStatus(theme.scenes, status) : [optionsForStatus(theme.scenes, status)[0]!])
  for (const personality of variation.personalities ? theme.personalities : [theme.personalities[0]!])
  for (const personalDetail of ["", "Sleeps on my pillow every single night, always"]) {
    const answers: SeasonalPolaroidPromptAnswers = {
      themeId: "halloween",
      locale,
      petName,
      species: kind,
      status,
      costume: costume.id,
      scene: scene.id,
      vibe: optionsForStatus(theme.vibes, status)[0]!.id,
      personalities: [personality.id],
      habit: habit.id,
      favoriteTreat: treat.id,
      customTreat: treat.id === "custom" ? "a very long homemade pumpkin spice treat bar" : undefined,
      ...owner,
      personalDetail,
      generationNonce: variation.nonce,
    };
    const memo = fallbackSeasonalPolaroidMemo(answers);
    const result = validateSeasonalPolaroidMemo(memo, answers);
    assert.equal(result.valid, true, `${JSON.stringify(answers)} → ${JSON.stringify(memo.lines)} → ${JSON.stringify(result)}`);
    checked += 1;
  }
  assert.ok(checked > 20_000, `expected a broad sweep, checked ${checked}`);
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
    favoriteTreat: "tuna",
    ownerCallName: "Mom",
    personalDetail: "Waits by the window.",
  });
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
  assert.match(generator, /const references = \[primary\];/);
  assert.doesNotMatch(generator, /secondary/);
  assert.match(generator, /size: "1024x1024"/);
  assert.match(generator, /OPENAI_CHAT_OPTIONS/);
  assert.match(generator, /response_format: seasonalMemoResponseFormat\(answers\.locale as "en" \| "ko"\)/);
  assert.match(generator, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(generator, /fallbackSeasonalPolaroidMemo/);
  assert.match(generator, /gpt-4o-mini/);
});

test("Chime regression: an unfinished last line or a dangling line break is rejected", () => {
  const chime: SeasonalPolaroidPromptAnswers = {
    ...LIVING,
    petName: "Chime",
    species: "dog",
    costume: "bat-wings",
    scene: "moonlit-forest",
    personalities: ["sleepyhead"],
    habit: "head-tilt",
    favoriteTreat: "jerky",
    personalDetail: "",
  };
  const unfinished = ["Mom, happy Halloween from Chime!", "I'm ready for cozy naps tonight", "with my bat wings and big grin,", "and this spooky"];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: unfinished }, chime), { valid: false, reason: "memo_incomplete" });
  const danglingBreak = ["Mom, happy Halloween from Chime!", "I'm ready for cozy naps with", "my bat wings and a big grin,", "and this spooky night feels like home."];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: danglingBreak }, chime), { valid: false, reason: "memo_incomplete" });
  const noClosingMark = ["Mom, happy Halloween from Chime!", "I'm ready for cozy naps tonight,", "bat wings on and a big grin,", "and this spooky night feels like home"];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: noClosingMark }, chime), { valid: false, reason: "memo_incomplete" });
  const complete = ["Mom, happy Halloween from Chime!", "I'm ready for cozy naps tonight,", "bat wings on and a big grin,", "and this spooky night feels like home."];
  assert.equal(validateSeasonalPolaroidMemo({ locale: "en", lines: complete }, chime).valid, true);
  // Trailing commas and connector-led lines remain the normal way to flow.
  const flowing = ["Mom, happy Halloween from Chime!", "I'm all bat wings and sleepy grins,", "nose in the leaves, tail going,", "and this is my kind of spooky."];
  assert.equal(validateSeasonalPolaroidMemo({ locale: "en", lines: flowing }, chime).valid, true);
});

test("Choco regression: a line cut after a transitive participle or a determiner plus adjective is incomplete", () => {
  const choco: SeasonalPolaroidPromptAnswers = { ...LIVING, petName: "Choco", species: "dog", costume: "bat-wings", scene: "moonlit-forest", personalities: ["sleepyhead"], habit: "head-tilt", favoriteTreat: "jerky", personalDetail: "" };
  // The reported captions.
  const feeling = ["Mom, happy Halloween from Choco!", "I'm out here in my witch hat,", "smiling in the moonlight, feeling,", "and this night is all mine."];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: feeling }, choco), { valid: false, reason: "memo_incomplete" });
  const spookyMidway = ["Mom, happy Halloween from Choco!", "I'm out here in my witch hat,", "grinning at the moon and this spooky,", "night feels like it was made for me."];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: spookyMidway }, choco), { valid: false, reason: "memo_incomplete" });
  const spookyLast = ["Mom, happy Halloween from Choco!", "I'm out here in my witch hat,", "grinning at the moon tonight,", "and this spooky"];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines: spookyLast }, choco), { valid: false, reason: "memo_incomplete" });
  // Other cut-offs of the same kind.
  for (const line3 of ["wearing,", "in the moonlight, because", "and here I am looking,", "and the moonlight feels like,", "this is where I", "I'm here with my little,", "and it's such a cozy"]) {
    const lines = ["Mom, happy Halloween from Choco!", "I'm out here in my witch hat,", line3, "and this night is all mine."];
    assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "en", lines }, choco), { valid: false, reason: "memo_incomplete" }, line3);
  }
  // Sentences that continue across lines after a complete phrase stay valid.
  const valid = [
    ["I'm out here in my witch hat,", "smiling in the moonlight, feeling brave,", "and this spooky night is all mine."],
    ["I'm feeling extra brave tonight,", "nose in the leaves, tail going,", "and this is my kind of spooky."],
    ["I'm by the door waiting,", "ears up, witch hat on,", "and Halloween is my favorite."],
    ["I'm all cozy in my little hat,", "the moon is bright and I'm so happy,", "and this night feels like home."],
    ["I'm wearing my hat with pride,", "it's my favorite, honestly,", "and the moon knows it too."],
  ];
  for (const body of valid) {
    const result = validateSeasonalPolaroidMemo({ locale: "en", lines: ["Mom, happy Halloween from Choco!", ...body] }, choco);
    assert.equal(result.valid, true, `${body[1]} :: ${JSON.stringify(result)}`);
  }
  // Korean: a degree adverb or determiner cannot end a line, while an adnominal cut is already caught.
  const ko: SeasonalPolaroidPromptAnswers = { ...LIVING, locale: "ko", petName: "초코" };
  for (const line3 of ["달빛 아래서 너무,", "달빛 아래서 이런,", "호박 모자 쓴 내"]) {
    const lines = ["엄마, 초코야! 해피 할로윈!", "오늘은 마녀 모자 쓰고,", line3, "이런 밤이 제일 좋아."];
    assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "ko", lines }, ko), { valid: false, reason: "memo_incomplete" }, line3);
  }
  assert.equal(validateSeasonalPolaroidMemo({ locale: "ko", lines: ["엄마, 초코야! 해피 할로윈!", "오늘은 마녀 모자 쓰고,", "달빛 아래서 너무 신나,", "이런 밤이 제일 좋아."] }, ko).valid, true);
  // The prompt teaches the same rule instead of asking for lines to be filled out.
  const prompt = buildSeasonalPolaroidMemoSystemPrompt("en", "living");
  assert.match(prompt, /break only after a complete phrase/);
  assert.match(prompt, /add a connector or filler just to join lines; a shorter natural line is always better/);
});

test("Korean completeness allows sentence-final syllables and rejects connective or particle endings", () => {
  const answers: SeasonalPolaroidPromptAnswers = { ...LIVING, locale: "ko", petName: "모찌" };
  const good = ["엄마, 모찌야! 해피 할로윈!", "오늘은 호박 옷 입고,", "낙엽 위에서 코 킁킁,", "이런 할로윈이 제일 좋아"];
  assert.equal(validateSeasonalPolaroidMemo({ locale: "ko", lines: good }, answers).valid, true);
  const connective = ["엄마, 모찌야! 해피 할로윈!", "오늘은 호박 옷 입고,", "낙엽 위에서 코 킁킁,", "이런 할로윈이 제일 좋아서"];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "ko", lines: connective }, answers), { valid: false, reason: "memo_incomplete" });
  const particle = ["엄마, 모찌야! 해피 할로윈!", "오늘은 호박 옷과", "낙엽 위에서 코 킁킁,", "이런 할로윈이 제일 좋아."];
  assert.deepEqual(validateSeasonalPolaroidMemo({ locale: "ko", lines: particle }, answers), { valid: false, reason: "memo_incomplete" });
});

test("every fallback and both prompt shape examples satisfy the completeness rule", () => {
  for (const locale of ["en", "ko"] as const) {
    const prompt = buildSeasonalPolaroidMemoSystemPrompt(locale, "living");
    assert.match(prompt, /Every line must be complete at its break/);
    const example = JSON.parse(prompt.match(/Shape example \(do not copy the words\): (\[.*\])/)![1]!) as string[];
    assert.equal(validateSeasonalPolaroidMemo({ locale, lines: example }, { ...LIVING, locale, petName: locale === "ko" ? "뚜리" : "Tuli" }).valid, true);
  }
});
