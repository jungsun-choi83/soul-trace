import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileForm = readFileSync("components/pet-profile-form.tsx", "utf8");
const editPetPage = readFileSync("app/my/pets/[petId]/edit/page.tsx", "utf8");
const petRoute = readFileSync("app/api/my/pets/[petId]/route.ts", "utf8");
const memoriesRoute = readFileSync("app/api/my/pets/[petId]/memories/route.ts", "utf8");
const copy = readFileSync("lib/storybook-copy.ts", "utf8");

test("pet profile requests surface fetch and profile-photo upload failures", () => {
  assert.match(profileForm, /catch \{\s*setSaving\(false\);\s*setError\("profile"\)/);
  assert.match(profileForm, /if \(!uploaded\)[\s\S]*setError\("photo"\)/);
  assert.match(editPetPage, /photoError/);
  assert.match(editPetPage, /initialError=\{rawPhotoError === "1" \? "photo" : null\}/);
  assert.match(copy, /savePetPhotoError:/);
});

test("pet editing updates only the selected owner-owned row and leaves Pet ID immutable", () => {
  assert.match(petRoute, /\.update\(petPatchRow\(/);
  assert.match(petRoute, /\.eq\("pet_id", access\.pet\.pet_id\)/);
  assert.match(petRoute, /\.eq\("owner_user_id", access\.user\.id\)/);
  assert.doesNotMatch(petRoute, /\.update\(\s*\{[^}]*pet_id:/);
});

test("historical memory query failures remain visible while asset signing failures are logged and partial", () => {
  assert.match(memoriesRoute, /historical memory read failed/);
  assert.match(memoriesRoute, /memory asset signing partially failed/);
  assert.match(memoriesRoute, /failedAssetSigningCount \+= signed\.failedCount/);
  assert.match(memoriesRoute, /logSigningFailures\(failedAssetSigningCount\)/);
  assert.match(memoriesRoute, /return privateJson\(\{ error: "unavailable" \}, 503\)/);
  assert.doesNotMatch(memoriesRoute, /timeline asset signing failed|historical photo signing failed|historical video signing failed/);
});
