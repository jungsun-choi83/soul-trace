import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLetterAddressingBlock,
  resolveKoreanOwnerAddress,
  type PetIntroProfile,
} from "./pet-profile.ts";

const base: PetIntroProfile = {
  petName: "Coco",
  petNickname: "",
  petGender: "female",
  petType: "dog",
  yearMet: "2018",
  yearParted: "2024",
  letterRecipient: "sister",
  letterRecipientDetail: "",
};

test("resolves Korean sibling address from pet gender and relationship", () => {
  assert.equal(resolveKoreanOwnerAddress("female", "sister"), "언니");
  assert.equal(resolveKoreanOwnerAddress("female", "brother"), "오빠");
  assert.equal(resolveKoreanOwnerAddress("male", "sister"), "누나");
  assert.equal(resolveKoreanOwnerAddress("male", "brother"), "형");
  assert.equal(resolveKoreanOwnerAddress("female", "Sister"), "언니");
  assert.equal(resolveKoreanOwnerAddress("male", "Brother"), "형");
});

test("does not guess when gender or relationship is incomplete or unsupported", () => {
  assert.equal(resolveKoreanOwnerAddress("", "sister"), null);
  assert.equal(resolveKoreanOwnerAddress("female", ""), null);
  assert.equal(resolveKoreanOwnerAddress("female", "mom"), null);
});

test("Korean Living and Memorial prompts receive the resolved term", () => {
  for (const mode of ["living", "memorial"] as const) {
    const prompt = buildLetterAddressingBlock("ko", base, mode);
    assert.match(prompt, /언니/);
    assert.match(prompt, /다른 가족 호칭이나 이름으로 바꾸지 않는다/);
  }
});

test("English prompts do not receive Korean relationship terms", () => {
  const prompt = buildLetterAddressingBlock("en", base, "living");
  assert.match(prompt, /Sister/);
  assert.doesNotMatch(prompt, /언니|오빠|누나|형/);
});

test("questionnaire relationship values remain Sister and Brother", () => {
  assert.equal(base.letterRecipient, "sister");
  assert.equal(resolveKoreanOwnerAddress("male", "brother"), "형");
});
