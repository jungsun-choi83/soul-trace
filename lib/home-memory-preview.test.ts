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

test("Living and Memorial Home link to the pet-scoped album and no longer build monthly lists from recent records", () => {
  const living = readFileSync("components/living-home.tsx", "utf8");
  const memorial = readFileSync("components/memorial-home.tsx", "utf8");
  const data = readFileSync("lib/pet-first-archive-data.ts", "utf8");
  for (const source of [living, memorial]) {
    assert.match(source, /recentMemoriesForPet\(recent, petId\)/);
    assert.match(source, /\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories#album/);
    assert.match(source, /<HomeRecentMemories/);
    assert.doesNotMatch(source, /groupMonths|item\.title \|\| item\.happenedOn \|\| item\.petName/);
  }
  assert.match(data, /takeRecentRowsPerPet\(entries, \(entry\) => entry\.pet_id, 6\)/);
  assert.doesNotMatch(data, /entries\.slice\(0, 6\)/);
});

test("Home photo-import shortcuts open the selected pet's Record flow", () => {
  const living = readFileSync("components/living-home.tsx", "utf8");
  const memorial = readFileSync("components/memorial-home.tsx", "utf8");
  for (const source of [living, memorial]) {
    assert.match(source, /\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories\/record/);
    assert.doesNotMatch(source, /\/memories\/import\?pet=/);
  }
});
