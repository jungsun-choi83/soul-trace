import assert from "node:assert/strict";
import test from "node:test";

import { loadPetRosterForUser } from "./pet-roster-loader.ts";
import type { HomePet } from "./pet-first-archive-data.ts";

const pet: HomePet = {
  petId: "pet-1",
  petName: "Momo",
  lifeStatus: "living",
  species: "dog",
  birthday: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  entryDays: [],
  letterCount: 0,
  avatarUrl: null,
};

test("roster loads after owner setup succeeds", async () => {
  const result = await loadPetRosterForUser("user-1", async () => true, async () => ({ pets: [pet], recent: [] }));
  assert.deepEqual(result, { status: "ready", pets: [pet] });
});

test("genuine empty roster is ready", async () => {
  const result = await loadPetRosterForUser("user-1", async () => true, async () => ({ pets: [], recent: [] }));
  assert.deepEqual(result, { status: "ready", pets: [] });
});

test("owner setup failure is unavailable and does not load pet data", async () => {
  let loaded = false;
  const result = await loadPetRosterForUser("user-1", async () => false, async () => {
    loaded = true;
    return { pets: [pet], recent: [] };
  });
  assert.deepEqual(result, { status: "unavailable" });
  assert.equal(loaded, false);
});

test("pet query failure is reported instead of shown as an empty account", async () => {
  const result = await loadPetRosterForUser("user-1", async () => true, async () => null);
  assert.deepEqual(result, { status: "unavailable" });
});
