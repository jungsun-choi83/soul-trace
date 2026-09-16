import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const petIntroForm = readFileSync("components/pet-intro-form.tsx", "utf8");

test("Other pet type skips breed and continues to years together", () => {
  assert.match(
    petIntroForm,
    /if \(petType === ["']other["']\) return \[["']name["'], ["']type["'], ["']years["'], ["']recipient["']\]/,
  );
});
