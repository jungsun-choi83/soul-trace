import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatHomeMemoryDate,
  homeMemoryPreviewTitle,
  recentMemoriesForPet,
  takeRecentRowsPerPet,
  type HomeMemoryPreview,
} from "./home-memory-preview.ts";

const entry = (overrides: Partial<HomeMemoryPreview> = {}): HomeMemoryPreview => ({
  entryId: "entry-1",
  petId: "pet-a",
  kind: "photo",
  title: null,
  story: null,
  happenedOn: null,
  createdAt: "2026-11-11T08:00:00.000Z",
  imageUrl: null,
  ...overrides,
});

test("home preview selection stays with the selected pet", () => {
  const recent = [entry({ entryId: "a1" }), entry({ entryId: "b1", petId: "pet-b" }), entry({ entryId: "a2" })];
  assert.deepEqual(recentMemoriesForPet(recent, "pet-a").map((item) => item.entryId), ["a1", "a2"]);
  assert.deepEqual(recentMemoriesForPet(recent, null), []);
});

test("home data retains a recent window for each pet instead of only six entries for the whole account", () => {
  const rows = [
    { pet_id: "pet-a", entry: "a1" },
    { pet_id: "pet-b", entry: "b1" },
    { pet_id: "pet-a", entry: "a2" },
    { pet_id: "pet-a", entry: "a3" },
    { pet_id: "pet-b", entry: "b2" },
  ];
  assert.deepEqual(takeRecentRowsPerPet(rows, (row) => row.pet_id, 2).map((row) => row.entry), ["a1", "b1", "a2", "b2"]);
});

test("untitled home previews use memory content or a localized kind label, never the pet name", () => {
  assert.equal(homeMemoryPreviewTitle(entry({ story: "A walk in the park" }), "en"), "A walk in the park");
  assert.equal(homeMemoryPreviewTitle(entry({ kind: "video" }), "en"), "Video memory");
  assert.equal(homeMemoryPreviewTitle(entry({ kind: "text" }), "ko"), "글 기록");
});

test("home preview dates are formatted for the locale instead of rendered as raw ISO dates", () => {
  const formatted = formatHomeMemoryDate(entry({ happenedOn: "2021-08-07" }), "en");
  assert.ok(formatted?.includes("2021"));
  assert.notEqual(formatted, "2021-08-07");
});

test("Living and Memorial homes keep each pet's memories and do not rebuild a month list on the home", () => {
  const living = readFileSync("components/living-home.tsx", "utf8");
  const memorial = readFileSync("components/memorial-home.tsx", "utf8");
  const data = readFileSync("lib/pet-first-archive-data.ts", "utf8");
  assert.match(living, /memoriesMonthHref\(petId\)/);
  assert.match(memorial, /recentMemoriesForPet\(recent, petId\)/);
  assert.match(memorial, /\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories#album/);
  assert.match(memorial, /언제든 다시 꺼내는 추억/);
  assert.doesNotMatch(living, /groupMonths|item\.title \|\| item\.happenedOn \|\| item\.petName/);
  assert.doesNotMatch(memorial, /groupMonths|item\.title \|\| item\.happenedOn \|\| item\.petName/);
  assert.match(data, /coverIds/);
  assert.doesNotMatch(data, /groupMonths/);
});

test("Home photo-import shortcuts stay on the selected pet", () => {
  const living = readFileSync("components/living-home.tsx", "utf8");
  const memorial = readFileSync("components/memorial-home.tsx", "utf8");
  assert.match(living, /\/memories\?pet=\$\{encodeURIComponent\(petId\)\}/);
  assert.match(memorial, /\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories\/record/);
  assert.doesNotMatch(living, /\/memories\/import\?pet=/);
  assert.doesNotMatch(memorial, /\/memories\/import\?pet=/);
});
