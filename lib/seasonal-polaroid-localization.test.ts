import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Messages } from "./i18n.ts";
import { getMessage } from "./i18n.ts";
import { HALLOWEEN_POLAROID_THEME } from "./seasonal-polaroid.ts";

const component = readFileSync("components/polaroid-entry.tsx", "utf8");

function seasonalPath(suffix: string): string {
  return `seasonalPolaroid.flow.${suffix}`;
}

function allOptionLabelKeys(): string[] {
  const options = [
    { id: "dog", labelKey: "options.species.dog" },
    { id: "cat", labelKey: "options.species.cat" },
    { id: "rabbit", labelKey: "options.species.rabbit" },
    { id: "hamster", labelKey: "options.species.hamster" },
    { id: "bird", labelKey: "options.species.bird" },
    { id: "other", labelKey: "options.species.other" },
    { id: "living", labelKey: "options.status.living" },
    { id: "passed", labelKey: "options.status.passed" },
    ...HALLOWEEN_POLAROID_THEME.costumes,
    ...HALLOWEEN_POLAROID_THEME.scenes,
    ...HALLOWEEN_POLAROID_THEME.vibes,
    ...HALLOWEEN_POLAROID_THEME.personalities,
    ...Object.values(HALLOWEEN_POLAROID_THEME.habitsBySpecies).flat(),
    ...Object.values(HALLOWEEN_POLAROID_THEME.treatsBySpecies).flat(),
    ...HALLOWEEN_POLAROID_THEME.callNames,
  ];
  return [...new Set(options.map((option) => option.labelKey))];
}

function allWhisperKeys(): string[] {
  const { whispers } = HALLOWEEN_POLAROID_THEME;
  return [
    "whispers.default",
    "whispers.defaultLiving",
    "whispers.defaultPassed",
    whispers.default.key,
    whispers.photo.key,
    whispers.habit.key,
    whispers.treat.key,
    whispers.callName.key,
    ...whispers.costume.map((rule) => rule.key),
    ...whispers.scene.map((rule) => rule.key),
    ...whispers.vibe.map((rule) => rule.key),
    ...whispers.personality.map((rule) => rule.key),
  ].map(seasonalPath);
}

test("all Seasonal Polaroid option labels exist in both locales", () => {
  for (const suffix of allOptionLabelKeys()) {
    const path = seasonalPath(suffix);
    for (const [locale, messages] of [["en", en], ["ko", ko]] as const) {
      const value = getMessage(messages as unknown as Messages, path);
      assert.notEqual(value, path, `${locale}: missing ${path}`);
      assert.ok(value.trim().length > 0, `${locale}: empty ${path}`);
    }
  }
});

test("all Seasonal Polaroid whisper messages exist in both locales", () => {
  for (const path of allWhisperKeys()) {
    for (const [locale, messages] of [["en", en], ["ko", ko]] as const) {
      const value = getMessage(messages as unknown as Messages, path);
      assert.notEqual(value, path, `${locale}: missing ${path}`);
      assert.ok(value.trim().length > 0, `${locale}: empty ${path}`);
    }
  }
});

test("generation states are localized in both locales", () => {
  const keys = [
    "eyebrow", "developingTitle", "readyTitle", "developingPhoto", "memoWaiting",
    "queued", "processing", "inProgress", "failed", "pollingError", "imageUnavailable",
    "requestError", "retry", "startOver", "messages.livingOne", "messages.passedOne",
    "emailHeading", "emailDescription", "emailLabel", "emailPlaceholder", "emailContinue",
    "emailSupporting", "emailInvalid", "emailVerificationSoon", "emailClose", "emailCodeHeading",
    "emailCodeDescription", "emailCodeLabel", "emailCodePlaceholder", "emailCodeSupporting",
    "emailVerify", "emailSending", "emailVerifying", "emailResend", "emailResendCountdown",
    "emailResendWait", "emailChange", "emailSendFailed", "emailVerifyFailed", "emailCodeInvalid",
    "emailCodeExpired", "emailUnavailable",
  ];
  for (const suffix of keys) {
    const path = seasonalPath(`generation.${suffix}`);
    for (const [locale, messages] of [["en", en], ["ko", ko]] as const) {
      const value = getMessage(messages as unknown as Messages, path);
      assert.notEqual(value, path, `${locale}: missing ${path}`);
      assert.ok(value.trim().length > 0, `${locale}: empty ${path}`);
    }
  }
});

test("all six Seasonal Polaroid screens have localized copy in both locales", () => {
  const screenKeys = [
    "kicker",
    "title",
    "titlePassed",
    "intro",
    "introPassed",
  ];
  for (let screen = 1; screen <= 6; screen += 1) {
    for (const key of screenKeys) {
      const path = seasonalPath(`screen${screen}.${key}`);
      for (const [locale, messages] of [["en", en], ["ko", ko]] as const) {
        const value = getMessage(messages as unknown as Messages, path);
        assert.notEqual(value, path, `${locale}: missing ${path}`);
        assert.ok(value.trim().length > 0, `${locale}: empty ${path}`);
      }
    }
  }
});

test("Polaroid component resolves option and whisper keys inside the flow namespace", () => {
  assert.match(component, /seasonalPolaroid\.flow\.\$\{option\.labelKey\}/);
  assert.match(component, /seasonalPolaroid\.flow\.\$\{whisperRule\.key\}/);
  assert.doesNotMatch(component, /seasonalPolaroid\.(?:options|whispers)\./);
});

test("terminal generation failures leave the developing view and keep answers available", () => {
  assert.match(component, /response\.status === "failed"[\s\S]{0,500}setView\("result"\)/);
  assert.match(component, /onRetry=\{\(\) => \{[\s\S]{0,180}setGenerationSession\(null\);[\s\S]{0,100}setView\("questionnaire"\)/);
});

test("email OTP gates generation without starting an AI job before verification", () => {
  assert.match(component, /setEmailModalOpen\(true\)/);
  assert.match(component, /emailVerificationReady/);
  assert.match(component, /emailHeading/);
  assert.match(component, /emailInvalid/);
  assert.match(component, /requestLetterDownloadCode/);
  assert.match(component, /verifyLetterDownloadCode/);
  assert.match(component, /emailResend/);
  assert.match(component, /emailChange/);

  const requestStart = component.indexOf("const requestGenerationCode");
  const verifyStart = component.indexOf("const verifyGenerationCode", requestStart);
  const runStart = component.indexOf("const runGeneration", verifyStart);
  assert.ok(requestStart >= 0, "the modal should have a dedicated code-request handler");
  assert.ok(verifyStart > requestStart, "verification should be a separate step");
  assert.ok(runStart > verifyStart, "generation should remain after verification");
  assert.doesNotMatch(component.slice(requestStart, verifyStart), /admitSeasonalPolaroid/);
});

test("successful status waits for the private image before leaving developing", () => {
  const imageFetch = component.indexOf("const objectUrl = await fetchSeasonalPolaroidImage(");
  const imageLoaded = component.indexOf("setImageLoading(false);", imageFetch);
  const resultView = component.indexOf('setView("result");', imageLoaded);
  assert.ok(imageFetch >= 0, "the success path should fetch the private result image");
  assert.ok(imageLoaded > imageFetch, "the result image must finish loading before the result view");
  assert.ok(resultView > imageLoaded, "the result view must wait for the image load");
  const successStart = component.indexOf("setGenerationResult(response.result);");
  const tokenLookup = component.indexOf("const accessToken", successStart);
  const prematureView = component.indexOf('setView("result");', successStart);
  assert.ok(prematureView < 0 || prematureView > tokenLookup, "success must not leave developing before token handling");
});

test("final Polaroid composition uses the stable decorative template and caption-only overlay", () => {
  assert.ok(existsSync("public/images/soul_trace_seasonal_polaroid_blank_caption_template.png"));
  assert.match(component, /soul_trace_seasonal_polaroid_blank_caption_template\.png/);
  assert.match(component, /aspect-\[2\/3\]/);
  assert.match(component, /memoLines\.slice\(0, 4\)/);
  assert.match(component, /output\.width = 1080/);
  assert.match(component, /output\.height = 1620/);
  assert.doesNotMatch(component, /cardTitle/);
});
