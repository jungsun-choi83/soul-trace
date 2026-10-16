import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const petIntroForm = readFileSync("components/pet-intro-form.tsx", "utf8");

test("Other pet type skips breed and continues to years together", () => {
  assert.match(
    petIntroForm,
    /if \(petType === ["']other["']\) return \[["']name["'], ["']gender["'], ["']type["'], ["']years["'], ["']recipient["']\]/,
  );
});

test("Pet gender follows name in the shared intro question order", () => {
  assert.match(
    petIntroForm,
    /const PET_INTRO_QUESTION_IDS = \[["']name["'], ["']gender["'], ["']type["'], ["']breed["'], ["']years["'], ["']recipient["']\]/,
  );
});
