import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  dashboardHomePath,
  entryHomePath,
  petsOnBranch,
  readEntryBranch,
  redirectForSelectedPet,
  writeEntryBranch,
  ENTRY_BRANCH_KEY,
} from "./entry-branch.ts";

test("anonymous choice is session state and never a database write", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
  writeEntryBranch(storage, "memorial");
  assert.equal(store.get(ENTRY_BRANCH_KEY), "memorial");
  assert.equal(readEntryBranch(storage), "memorial");
  assert.equal(readEntryBranch({ getItem: () => "living" }), "living");
  assert.equal(readEntryBranch({ getItem: () => "nope" }), null);
  assert.doesNotMatch(readFileSync("components/entry-choice.tsx", "utf8"), /lifeStatus|life_status/);
  assert.doesNotMatch(readFileSync("app/dashboard/living/page.tsx", "utf8"), /\.update\(|life_status/);
  assert.doesNotMatch(readFileSync("app/dashboard/memorial/page.tsx", "utf8"), /\.update\(|life_status/);
});

test("dashboard routing uses life_status and ignores letter history", () => {
  const unspecified = { petId: "pet-letter", lifeStatus: "unspecified" as const };
  assert.equal(dashboardHomePath([unspecified]), "/choose");
  assert.equal(dashboardHomePath([unspecified], "pet-letter"), "/choose?pet=pet-letter");
  assert.equal(
    dashboardHomePath([
      { petId: "live-1", lifeStatus: "living" },
      { petId: "memo-1", lifeStatus: "memorial" },
    ]),
    "/choose",
  );
  assert.equal(
    dashboardHomePath(
      [
        { petId: "live-1", lifeStatus: "living" },
        { petId: "memo-1", lifeStatus: "memorial" },
      ],
      "memo-1",
    ),
    "/dashboard/memorial?pet=memo-1",
  );
  assert.equal(dashboardHomePath([{ petId: "live-1", lifeStatus: "living" }]), "/dashboard/living?pet=live-1");
  assert.equal(entryHomePath("living"), "/dashboard/living");
  assert.equal(redirectForSelectedPet("living", { petId: "memo-1", lifeStatus: "memorial" }), "/dashboard/memorial?pet=memo-1");
  assert.equal(redirectForSelectedPet("living", { petId: "open-1", lifeStatus: "unspecified" }), null);
  const visible = petsOnBranch(
    [
      { petId: "live-1", lifeStatus: "living" as const },
      { petId: "memo-1", lifeStatus: "memorial" as const },
      { petId: "open-1", lifeStatus: "unspecified" as const },
    ],
    "living",
    "open-1",
  );
  assert.deepEqual(visible.map((pet) => pet.petId), ["live-1", "open-1"]);
});

test("the two homes stay separate from the letter pages", () => {
  const living = readFileSync("components/living-home.tsx", "utf8");
  const memorial = readFileSync("components/memorial-home.tsx", "utf8");
  const choose = readFileSync("app/choose/page.tsx", "utf8");
  assert.match(living, /우리 아이와 함께하는 오늘/);
  assert.match(memorial, /우리 아이와 함께했던 소중한 순간들/);
  assert.match(living, /href=\{letterHref\}/);
  assert.match(living, /\/living\?petId=/);
  assert.match(memorial, /\/memorial\?petId=/);
  assert.match(readFileSync("app/living/page.tsx", "utf8"), /SoulTraceFlow mode="living"/);
  assert.match(readFileSync("app/memorial/page.tsx", "utf8"), /SoulTraceFlow mode="memorial"/);
  assert.match(choose, /EntryChoice/);
  assert.match(choose, /ModeChoice/);
  assert.match(choose, /partnerEntryDestination/);
  assert.doesNotMatch(living, /memorial-space|mood-journal|가족 공유/);
  assert.doesNotMatch(memorial, /\/my\/device|스마트 목걸이|산책·활동 기록/);
});
