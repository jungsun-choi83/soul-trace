import assert from "node:assert/strict";
import test from "node:test";

import { decideLetterPetAccess, letterMatchesSelectedPet } from "./letter-pet-access.ts";

const PET_A = "11111111-1111-4111-8111-111111111111";

test("authenticated owner can use a Pet-First profile without a legacy link", () => {
  assert.deepEqual(decideLetterPetAccess({
    userId: "owner-a",
    requestedPetId: PET_A,
    ownedPetId: PET_A,
    verifiedLegacyLinkMatches: false,
    linkedPetOwnerId: "owner-a",
    hasConflictingSubmissionOwner: false,
  }), { allowed: true, source: "pet-first" });
});

test("verified legacy link remains usable when the pet has not been assigned", () => {
  assert.deepEqual(decideLetterPetAccess({
    userId: "owner-a",
    requestedPetId: PET_A,
    ownedPetId: null,
    verifiedLegacyLinkMatches: true,
    linkedPetOwnerId: null,
    hasConflictingSubmissionOwner: false,
  }), { allowed: true, source: "verified-legacy" });
});

test("a legacy link cannot grant access to another account's assigned pet", () => {
  assert.deepEqual(decideLetterPetAccess({
    userId: "owner-a",
    requestedPetId: PET_A,
    ownedPetId: null,
    verifiedLegacyLinkMatches: true,
    linkedPetOwnerId: "owner-b",
    hasConflictingSubmissionOwner: false,
  }), { allowed: false });
});

test("unowned pets without a matching verified legacy link are denied", () => {
  assert.deepEqual(decideLetterPetAccess({
    userId: "owner-a",
    requestedPetId: PET_A,
    ownedPetId: null,
    verifiedLegacyLinkMatches: false,
    linkedPetOwnerId: null,
    hasConflictingSubmissionOwner: false,
  }), { allowed: false });
});

test("a legacy link cannot expose submissions assigned to another account", () => {
  assert.deepEqual(decideLetterPetAccess({
    userId: "owner-a",
    requestedPetId: PET_A,
    ownedPetId: null,
    verifiedLegacyLinkMatches: true,
    linkedPetOwnerId: null,
    hasConflictingSubmissionOwner: true,
  }), { allowed: false });
});

test("reruns must keep the existing letter's pet association", () => {
  assert.equal(letterMatchesSelectedPet(PET_A, PET_A), true);
  assert.equal(letterMatchesSelectedPet(PET_A, "22222222-2222-4222-8222-222222222222"), false);
  assert.equal(letterMatchesSelectedPet(null, PET_A), false);
  assert.equal(letterMatchesSelectedPet(null, null), true);
});
