import assert from "node:assert/strict";
import test from "node:test";

import { splitCurrentAndUnclassifiedPets } from "./pet-review.ts";
import type { HomePet } from "./pet-first-archive-data.ts";

function pet(petId: string, lifeStatus: HomePet["lifeStatus"]): HomePet {
  return {
    petId,
    petName: "Same name",
    lifeStatus,
    species: null,
    birthday: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    entryDays: [],
    letterCount: 1,
    avatarUrl: null,
  };
}

test("review splits only by the saved life status, never by pet name or linked letters", () => {
  const result = splitCurrentAndUnclassifiedPets([
    pet("living", "living"),
    pet("memorial", "memorial"),
    pet("review-1", "unspecified"),
    pet("review-2", "unspecified"),
  ]);
  assert.deepEqual(result.current.map((item) => item.petId), ["living", "memorial"]);
  assert.deepEqual(result.unclassified.map((item) => item.petId), ["review-1", "review-2"]);
});

test("empty and all-unclassified rosters remain distinct", () => {
  assert.deepEqual(splitCurrentAndUnclassifiedPets([]), { current: [], unclassified: [] });
  assert.deepEqual(splitCurrentAndUnclassifiedPets([pet("review", "unspecified")]), {
    current: [],
    unclassified: [pet("review", "unspecified")],
  });
});
