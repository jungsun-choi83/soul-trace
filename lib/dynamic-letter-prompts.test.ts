import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildLetterAddressingBlock,
  buildLetterRequestFields,
  buildPetProfilePromptBlock,
  type PetIntroProfile,
} from "./pet-profile.ts";

const profile: PetIntroProfile = {
  petName: "Coco",
  petNickname: "Bean",
  petType: "dog",
  petBreed: "mixed-not-sure",
  petAge: "5",
  yearMet: "2018",
  yearParted: "2024",
  letterRecipient: "mom",
  letterRecipientDetail: "",
};

describe("dynamic letter composition", () => {
  it("does not prescribe the former fixed English openings or closings", () => {
    for (const mode of ["living", "memorial"] as const) {
      const prompt = buildLetterAddressingBlock("en", profile, mode);
      assert.doesNotMatch(prompt, /Open with exactly|Required closing|once, verbatim/i);
      assert.doesNotMatch(prompt, /I'll be right here waiting|I'll always stay close/i);
      assert.match(prompt, /supplied memory|selected mood/i);
      assert.match(prompt, /Vary the wording every time/i);
    }
  });

  it("keeps streaming, non-streaming, and language regeneration free of fixed endings", () => {
    const route = readFileSync("app/api/generate-letter/route.ts", "utf8");
    assert.doesNotMatch(route, /required closing|마무리 필수 문장/i);
    assert.match(route, /fresh memory-led opening and closing/i);
    assert.match(route, /No stock opening or closing/i);
  });

  it("uses flexible length guidance instead of fixed line targets", () => {
    const survey = readFileSync("lib/survey.ts", "utf8");
    assert.doesNotMatch(survey, /12줄 전후|20줄 전후|12 lines|20 lines/i);
    assert.match(survey, /do not pad, repeat, or target a fixed line count/i);
  });

  it("uses current semantic profile fields and excludes deleted-question controls", () => {
    for (const locale of ["en", "ko"] as const) {
      for (const mode of ["living", "memorial"] as const) {
        const prompt = buildPetProfilePromptBlock(locale, profile, mode);
        assert.match(prompt, locale === "en" ? /Years together: 5 years/ : /함께한 시간: 5년/);
        assert.match(prompt, /Mixed \/ Not Sure|믹스 \/ 잘 모르겠음/);
        assert.match(prompt, /do not infer a breed|품종을 추측하지 말 것/);
      }
    }

    const fields = buildLetterRequestFields(
      profile,
      { mood: "warm", length: "normal", options: ["frequent_name"] },
    );
    assert.ok(fields);
    assert.equal("preferredScenery" in fields, false);
    assert.deepEqual(fields.tonePrefs.options, []);
  });

  it("does not feed email, stamp data, deleted Q11, or a positional first answer into the AI prompt", () => {
    const route = readFileSync("app/api/generate-letter/route.ts", "utf8");
    const survey = readFileSync("lib/survey.ts", "utf8");
    assert.doesNotMatch(route, /body\.preferredScenery|answers\[0\]/);
    assert.match(route, /memoryQuestionCount\(channel\) \+ TONE_STEP_COUNT/);
    assert.doesNotMatch(route, /설문 8문항|Eight answers are required|memoryQuestionCount\(channel\) \+ 3/);
    assert.doesNotMatch(survey, /item\.id === "q11"|tonePrefs\.options\.includes/);
    assert.doesNotMatch(route, /stampPhoto|stampType/);
    assert.doesNotMatch(route, /promptFormattedAnswers[\s\S]{0,120}userEmail/);
  });

  it("uses the authenticated account email without an Email questionnaire step", () => {
    const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
    const generationRoute = readFileSync("app/api/generate-letter/route.ts", "utf8");
    const stampRoute = readFileSync("app/api/stamp-photo/route.ts", "utf8");
    const eligibilityRoute = readFileSync("app/api/check-letter-eligibility/route.ts", "utf8");
    const en = readFileSync("locales/en.json", "utf8");

    assert.doesNotMatch(flow, /questionnaireEmail|isEmailQuestion|userEmail/);
    assert.match(flow, /totalQuestionCount = introQuestionCount \+ surveyStepCount/);
    assert.doesNotMatch(flow, /totalQuestionCount = introQuestionCount \+ surveyStepCount \+ 1/);
    assert.doesNotMatch(en, /questionnaireEmail/);

    for (const route of [generationRoute, stampRoute, eligibilityRoute]) {
      assert.match(route, /createSupabaseAuthServerClient/);
      assert.match(route, /auth\.getUser\(\)/);
      assert.match(route, /authData\.user\?\.email/);
    }
    assert.doesNotMatch(generationRoute, /body\.userEmail/);
    assert.doesNotMatch(stampRoute, /form\?\.get\("userEmail"\)/);
  });

  it("persists each generation by letterId instead of enforcing one letter per email", () => {
    const route = readFileSync("app/api/generate-letter/route.ts", "utf8");
    const migration = readFileSync("supabase/migration_allow_multiple_letters_per_account.sql", "utf8");
    const en = readFileSync("locales/en.json", "utf8");
    const ko = readFileSync("locales/ko.json", "utf8");

    assert.doesNotMatch(route, /hasSavedLetter|alreadyGenerated|onConflict: "user_email"/);
    assert.match(route, /crypto\.randomUUID\(\)/);
    assert.match(route, /onConflict: "letter_id"/);
    assert.match(route, /onConflict: "letter_id,answer_order"/);
    assert.match(migration, /primary key \(letter_id\)/i);
    assert.doesNotMatch(en + ko, /one letter per|한 이메일당|같은 이메일로는 한 번만/);
  });
});
