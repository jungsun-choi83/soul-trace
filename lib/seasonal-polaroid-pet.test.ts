import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSeasonalPolaroidPetProfile,
  polaroidStatusFromLifeStatus,
  seasonalPolaroidDraftKey,
} from "./seasonal-polaroid-pet.ts";

test("Pet-First statuses map to Polaroid's living and passed values", () => {
  assert.equal(polaroidStatusFromLifeStatus("living"), "living");
  assert.equal(polaroidStatusFromLifeStatus("memorial"), "passed");
  assert.equal(polaroidStatusFromLifeStatus("unspecified"), null);
});

test("Polaroid drafts are isolated by canonical pet ID and from the guest draft", () => {
  assert.notEqual(seasonalPolaroidDraftKey("pet-a"), seasonalPolaroidDraftKey("pet-b"));
  assert.equal(seasonalPolaroidDraftKey("PET-A"), seasonalPolaroidDraftKey("pet-a"));
  assert.notEqual(seasonalPolaroidDraftKey("pet-a"), seasonalPolaroidDraftKey());
});

test("selected pet context must match the requested canonical ID", () => {
  const pet = { petId: "PET-A", petName: "Bubu", species: "dog", lifeStatus: "living" };
  assert.equal(parseSeasonalPolaroidPetProfile(pet, "pet-a")?.petName, "Bubu");
  assert.equal(parseSeasonalPolaroidPetProfile(pet, "pet-b"), null);
  assert.equal(parseSeasonalPolaroidPetProfile({ ...pet, petName: " " }, "pet-a"), null);
});
