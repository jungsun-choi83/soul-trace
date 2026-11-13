import assert from "node:assert/strict";
import test from "node:test";

import { persistedPolaroidOccasionId } from "./seasonal-polaroid-occasion.ts";

test("reads a persisted Christmas occasion without treating the frame as the occasion", () => {
  assert.equal(
    persistedPolaroidOccasionId({ occasionId: "christmas-little-ghost" }, "felt-doll"),
    "christmas-little-ghost",
  );
});

test("reads an explicitly selected Halloween occasion", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: "halloween" }, "gouache-story"), "halloween");
});

test("reads Adoption Day from the saved generation metadata", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: "adoption-day" }, "felt-doll"), "adoption-day");
});

test("reads Birthday from the saved generation metadata", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: "birthday-star" }, "felt-doll"), "birthday-star");
});

test("reads New Year from the saved generation metadata", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: "newyear-blessing" }, "crayon-diary"), "newyear-blessing");
});

test("reads the four newly implemented occasions from saved generation metadata", () => {
  for (const occasionId of ["valentine-letter", "spring-secret-garden", "summer-seaside", "halloween-mischief-ghost"]) {
    assert.equal(persistedPolaroidOccasionId({ occasionId }, "gouache-story"), occasionId);
  }
});

test("preserves no-occasion results as null", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: null }, "crayon-diary"), null);
  assert.equal(persistedPolaroidOccasionId({}, "felt-doll"), null);
});

test("recognizes historical Halloween by its legacy theme id only", () => {
  assert.equal(persistedPolaroidOccasionId(null, "halloween"), "halloween");
  assert.equal(persistedPolaroidOccasionId(null, "felt-doll"), null);
});

test("does not expose unknown or coming-soon occasions", () => {
  assert.equal(persistedPolaroidOccasionId({ occasionId: "not-a-real-occasion" }, "felt-doll"), null);
  assert.equal(persistedPolaroidOccasionId({ occasionId: "planned-occasion" }, "felt-doll"), null);
});
