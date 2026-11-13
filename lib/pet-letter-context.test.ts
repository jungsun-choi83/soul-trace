import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildPetLetterContextBlock,
  isKnownPetIntroQuestion,
  mergePetIntroFromContext,
  petLetterContextFromPayload,
  petLetterModeFromContext,
  petIntroFromContext,
  petTypeFromSpecies,
  skipKnownPetIntroQuestions,
  type PetLetterContext,
} from "./pet-letter-context.ts";

const context: PetLetterContext = {
  petId: "11111111-1111-4111-8111-111111111111",
  petName: "Bubu",
  lifeStatus: "living",
  species: "Dog",
  birthday: "2020-02-03",
  adoptedOn: "2021-04-05",
  traits: "Playful and gentle",
};

test("known pet identity fills and skips only the name and supported species questions", () => {
  assert.equal(petTypeFromSpecies("Dog"), "dog");
  assert.equal(petTypeFromSpecies("unknown small mammal"), "other");
  assert.equal(isKnownPetIntroQuestion("name", context), true);
  assert.equal(isKnownPetIntroQuestion("type", context), true);
  assert.equal(isKnownPetIntroQuestion("gender", context), false);
  assert.equal(isKnownPetIntroQuestion("years", context), false);
  assert.equal(isKnownPetIntroQuestion("recipient", context), false);
  const profile = petIntroFromContext(context, "living");
  assert.equal(profile.petName, "Bubu");
  assert.equal(profile.petType, "dog");
  assert.equal(profile.petGender, "");
  assert.equal(profile.letterRecipient, "");
});

test("question navigation skips saved fields while keeping missing questions", () => {
  const questionIds = ["name", "gender", "type", "breed", "years", "recipient"];
  assert.equal(skipKnownPetIntroQuestions(0, questionIds, context), 1);
  assert.equal(skipKnownPetIntroQuestions(2, questionIds, context), 3);
  assert.equal(skipKnownPetIntroQuestions(2, questionIds, context, -1), 1);
});

test("registered pet fields prefill only compatible questionnaire answers", () => {
  const profile = petIntroFromContext(context, "living");
  assert.equal(profile.petName, "Bubu");
  assert.equal(profile.petType, "dog");
  assert.equal(profile.yearMet, "2021");
  assert.equal(profile.yearParted, String(new Date().getFullYear()));
  assert.equal(profile.petGender, "");
  assert.equal(profile.petBreed, "");
  assert.equal(profile.petAge, "");
  assert.equal(profile.letterRecipient, "");
});

test("missing profile fields leave matching answers blank and editable", () => {
  const incomplete = { ...context, petName: "Bubu", species: null, adoptedOn: null };
  const profile = petIntroFromContext(incomplete, "memorial");
  assert.equal(profile.petName, "Bubu");
  assert.equal(profile.petType, "");
  assert.equal(profile.yearMet, "");
  assert.equal(profile.yearParted, "");
  assert.equal(profile.letterRecipient, "");
});

test("profile payloads are bound to the requested Pet ID for multiple pets", () => {
  const otherPet = {
    ...context,
    petId: "22222222-2222-4222-8222-222222222222",
    petName: "Coco",
    species: "Cat",
    lifeStatus: "memorial" as const,
  };
  const first = petLetterContextFromPayload(context, context.petId);
  const second = petLetterContextFromPayload(otherPet, otherPet.petId);
  assert.equal(first?.petName, "Bubu");
  assert.equal(second?.petName, "Coco");
  assert.equal(petLetterModeFromContext(second!), "memorial");
  assert.equal(petLetterContextFromPayload(otherPet, context.petId), null);
});

test("unauthorized or malformed profile responses cannot prefill the questionnaire", () => {
  assert.equal(petLetterContextFromPayload({ error: "not_found" }, context.petId), null);
  assert.equal(petLetterContextFromPayload({ ...context, species: 42 }, context.petId), null);
  assert.equal(petLetterContextFromPayload(null, context.petId), null);

  const route = readFileSync(new URL("../app/api/my/pets/[petId]/route.ts", import.meta.url), "utf8");
  assert.match(route, /requireOwnedPet\(petId\)/);
});

test("questionnaire fetch is authenticated, Pet-ID scoped, and follows the saved status", () => {
  const flow = readFileSync(new URL("../components/soul-trace-flow.tsx", import.meta.url), "utf8");
  assert.match(flow, /authSession\.status !== "authenticated"/);
  assert.match(flow, /\/api\/my\/pets\/\$\{encodeURIComponent\(requestedPetId\)\}/);
  assert.match(flow, /if \(!response\.ok\) return;/);
  assert.match(flow, /petLetterContextFromPayload\(payload, requestedPetId\)/);
  assert.match(flow, /destination\.pathname = letterModePath\(savedMode\)/);
  assert.match(flow, /petIntroTouchedFieldsRef\.current\.add\(field\)/);
});

test("late prefill preserves user-edited fields and fills untouched fields", () => {
  const edited = {
    ...petIntroFromContext(null, "living"),
    petName: "My name for Bubu",
    petType: "cat" as const,
  };
  const merged = mergePetIntroFromContext(
    edited,
    context,
    "living",
    new Set(["petName", "petType"]),
  );
  assert.equal(merged.petName, "My name for Bubu");
  assert.equal(merged.petType, "cat");
  assert.equal(merged.yearMet, "2021");
});

test("saved context block is localized and contains only actual saved values", () => {
  const english = buildPetLetterContextBlock(context, "en");
  assert.match(english, /Saved species: Dog/);
  assert.match(english, /Birthday: 2020-02-03/);
  assert.match(english, /Adoption date: 2021-04-05/);
  assert.match(english, /Saved traits: Playful and gentle/);
  const unspecified = buildPetLetterContextBlock({ ...context, lifeStatus: "unspecified" }, "ko");
  assert.doesNotMatch(unspecified, /Saved life status/);
  assert.match(unspecified, /저장된 특징/);
});
