import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveRecipientAddress, type PetIntroProfile } from "./pet-profile.ts";

const base: PetIntroProfile = {
  petName: "Coco",
  petNickname: "",
  petType: "dog",
  yearMet: "2018",
  yearParted: "2024",
  letterRecipient: "mom",
  letterRecipientDetail: "",
};

describe("recipient-aware letter heading", () => {
  const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
  const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

  it("uses a recipient placeholder for Living and Memorial in both languages", () => {
    for (const mode of ["living", "memorial"] as const) {
      assert.equal(en.modes[mode].letterHeading, "A letter to %RECIPIENT%");
      assert.equal(ko.modes[mode].letterHeading, "%RECIPIENT%에게 보내는 편지");
    }
  });

  it("resolves every predefined English recipient", () => {
    const expected = {
      mom: "Mom",
      dad: "Dad",
      both: "Mom and Dad",
      sister: "Sister",
      brother: "Brother",
      sibling: "Sister / Brother",
    } as const;

    for (const [letterRecipient, recipient] of Object.entries(expected)) {
      const profile = { ...base, letterRecipient: letterRecipient as keyof typeof expected };
      const title = en.modes.living.letterHeading.replace(
        "%RECIPIENT%",
        resolveRecipientAddress(profile, "en"),
      );
      assert.equal(title, `A letter to ${recipient}`);
    }
  });

  it("uses entered names and preserves legacy custom recipient wording", () => {
    for (const letterRecipient of ["byName", "custom"] as const) {
      const profile = { ...base, letterRecipient, letterRecipientDetail: "Jamie" };
      assert.equal(resolveRecipientAddress(profile, "en"), "Jamie");
      assert.equal(resolveRecipientAddress(profile, "ko"), "Jamie");
    }
  });

  it("renders the resolved title inside the captured letter preview", () => {
    const source = readFileSync("components/soul-trace-flow.tsx", "utf8");
    assert.match(source, /const letterHeading = copy\.letterHeading\.replace/);
    assert.match(source, /resolveRecipientAddress\(petIntro, lang\)/);
    assert.match(source, /\{activeLetterStructure\.title \|\| letterHeading\}/);
    assert.doesNotMatch(source, /\{copy\.letterHeading\}/);
  });
});
