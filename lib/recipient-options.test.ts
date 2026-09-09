import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildLetterRequestFields,
  isPetIntroComplete,
  resolveRecipientAddress,
  type LetterRecipient,
  type PetIntroProfile,
} from "./pet-profile.ts";
import { EMPTY_TONE_PREFS } from "./survey.ts";

const source = readFileSync("components/pet-intro-form.tsx", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));

function profile(letterRecipient: LetterRecipient, detail = ""): PetIntroProfile {
  return {
    petName: "Coco",
    petNickname: "",
    petType: "dog",
    yearMet: "2018",
    yearParted: "2024",
    letterRecipient,
    letterRecipientDetail: detail,
  };
}

describe("separate sister and brother relationships", () => {
  it("shows Sister and Brother as separate localized buttons", () => {
    assert.match(
      source,
      /const RECIPIENTS:[\s\S]{0,220}"sister",[\s\S]{0,80}"brother"/,
    );
    assert.equal(en.form.step1.recipients.sister, "Sister");
    assert.equal(en.form.step1.recipients.brother, "Brother");
  });

  it("does not expose Custom or legacy sibling in the visible selector", () => {
    const selectableList = source.match(/const RECIPIENTS:[\s\S]*?\];/)?.[0] ?? "";
    assert.doesNotMatch(selectableList, /"custom"|"sibling"/);
    assert.equal(source.match(/profile\.letterRecipient === "custom"/g), null);
  });

  for (const [relationship, recipient] of [
    ["sister", "Sister"],
    ["brother", "Brother"],
  ] as const) {
    it(`sends ${relationship} and generates the correct title`, () => {
      const value = profile(relationship);
      const payload = buildLetterRequestFields(value, [], {
        ...EMPTY_TONE_PREFS,
        mood: "warm",
        length: "short",
      });
      assert.equal(payload?.relationship, relationship);
      assert.equal(payload?.letterRecipient, relationship);
      assert.equal(resolveRecipientAddress(value, "en"), recipient);
      assert.equal(
        en.modes.living.letterHeading.replace("%RECIPIENT%", recipient),
        `A letter to ${recipient}`,
      );
    });
  }

  it("keeps legacy sibling and custom records readable", () => {
    const sibling = profile("sibling");
    const custom = profile("custom", "Grandma Lee");
    assert.equal(resolveRecipientAddress(sibling, "en"), "Sister / Brother");
    assert.equal(resolveRecipientAddress(custom, "en"), "Grandma Lee");
    assert.equal(isPetIntroComplete(sibling), true);
    assert.equal(isPetIntroComplete(custom), true);
  });
});
