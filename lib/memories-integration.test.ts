import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const memoriesRoute = readFileSync("app/api/my/pets/[petId]/memories/route.ts", "utf8");
const memoriesPage = readFileSync("app/memories/page.tsx", "utf8");
const memoriesArchive = readFileSync("components/memories-archive.tsx", "utf8");
const petMemory = readFileSync("components/pet-first-memory.tsx", "utf8");
const polaroidEntry = readFileSync("components/polaroid-entry.tsx", "utf8");
const polaroidMemoryPhotoRoute = readFileSync("app/api/my/pets/[petId]/memories/[entryId]/assets/[assetId]/route.ts", "utf8");

test("only pet-memory read failures make the timeline unavailable; Letter and Polaroid fields stay separate", () => {
  assert.match(memoriesRoute, /readOptionalMemoryRows\(\(\) => access\.supabase[\s\S]*soul_trace_submissions/);
  assert.match(memoriesRoute, /readOptionalMemoryRows\(\(\) => access\.supabase[\s\S]*seasonal_polaroid_results/);
  assert.match(memoriesRoute, /const legacyReadError = legacyPhotos\.error \?\? legacyVideos\.error \?\? legacyTexts\.error;/);
  assert.match(memoriesRoute, /optional Letter read failed/);
  assert.match(memoriesRoute, /optional Polaroid read failed/);
  assert.match(memoriesRoute, /return privateJson\(\{ timeline, letters, polaroids \}, 200\)/);

  for (const file of [
    "components/beam-scene-preview.tsx",
    "components/memorial-space.tsx",
    "components/memories-archive.tsx",
    "components/pet-first-memory.tsx",
  ]) {
    assert.match(readFileSync(file, "utf8"), /body\.timeline/);
  }
});

test("legacy memories do not offer a Favorites control that cannot be saved", () => {
  assert.match(memoriesArchive, /selected\.item\.deletable \? <button/);
  assert.match(memoriesArchive, /onClick=\{\(\) => void toggleFavorite\(selected\)\}/);
  assert.match(memoriesArchive, /selected\.item\.favorite \? "즐겨찾기 해제" : "즐겨찾기"/);
});

test("the pet Collection shows only favorites, including an actually empty result", () => {
  assert.match(petMemory, /view === "album" && currentSection === "collection"/);
  assert.match(petMemory, /favorites\.map\(\(item\) =>/);
  assert.doesNotMatch(petMemory, /favorites\.length \? favorites : album/);
});

test("editable memory details save story text through the owner and pet scoped patch route", () => {
  assert.match(petMemory, /textarea name="story" defaultValue=\{item\.story \?\? ""\} maxLength=\{2000\}/);
  assert.match(petMemory, /story: String\(data\.get\("story"\) \?\? ""\) \|\| null/);
  assert.match(memoriesRoute, /Object\.prototype\.hasOwnProperty\.call\(parsed\.value, "story"\)[\s\S]*story: parsed\.value\.story \?\? null/);
  assert.match(memoriesRoute, /current\.kind === "text"\) return privateJson\(\{ error: "invalid_memory" \}, 400\)/);
  assert.match(memoriesRoute, /\.eq\("owner_user_id", access\.user\.id\)[\s\S]*\.eq\("pet_id", access\.pet\.pet_id\)/);
  assert.match(petMemory, /selectedItem\.deletable \? \(patch\) => void patchMemory/);
});

test("the Memory Polaroid handoff uses an owner-checked private image response and keeps picker fallback", () => {
  assert.match(petMemory, /polaroidHrefFromArchive\(petId, selectedItem\.entryId, selectedItem\.assets\.find\(\(asset\) => asset\.contentType\.startsWith\("image\/"\)\)\?\.assetId\)/);
  assert.match(polaroidMemoryPhotoRoute, /requireOwnedPet\(petId\)/);
  assert.match(polaroidMemoryPhotoRoute, /isMissingRelationError\(entryError\.code\)/);
  assert.match(polaroidMemoryPhotoRoute, /\.eq\("owner_user_id", access\.user\.id\)[\s\S]*\.eq\("pet_id", access\.pet\.pet_id\)/);
  assert.match(polaroidMemoryPhotoRoute, /storage[\s\S]*\.download\(source\.storagePath\)/);
  assert.doesNotMatch(polaroidMemoryPhotoRoute, /createSignedUrl/);
  assert.match(polaroidEntry, /!response\.ok\) return/);
  assert.match(polaroidEntry, /selectedPet\?\.petId !== initialPetId/);
  assert.match(polaroidEntry, /selectedPetIdRef\.current !== initialPetId/);
  assert.match(polaroidEntry, /if \(photoRef\.current\) URL\.revokeObjectURL\(photoRef\.current\.url\);[\s\S]*setPrimaryPhoto\(null\)/);
  assert.match(polaroidEntry, /primaryInputRef\.current\?\.click\(\)/);
});

test("a signed-out Memories link keeps a validated requested pet through authentication", () => {
  assert.match(memoriesPage, /const requestedPetId = requested && isUuid\(requested\) \? requested : null/);
  assert.match(memoriesPage, /access="guest" pets=\{\[\]\} selectedPetId=\{requestedPetId\}/);
  assert.match(memoriesArchive, /GuestImport preview=\{localPreview\} petId=\{selectedPetId\}/);
  assert.match(memoriesArchive, /authEntryPath\(memoriesHref\(petId\), "signin"\)/);
});
