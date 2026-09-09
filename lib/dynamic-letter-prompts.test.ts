import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildLetterAddressingBlock, type PetIntroProfile } from "./pet-profile.ts";

const profile: PetIntroProfile = {
  petName: "Coco",
  petNickname: "Bean",
  petType: "dog",
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
});
