import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decidePetAccess,
  describeMemoryDate,
  isMissingRelationError,
  isOwnerStoragePath,
  isPetFirstArchiveEnabled,
  joinPetNotes,
  letterPathForLifeStatus,
  parsePetCreateInput,
  parsePetPatchInput,
  parseTextMemory,
  petFirstStoragePath,
  petInsertRow,
  petPatchRow,
  splitPetNotes,
  validatePhotoFiles,
  validateVideoFile,
  PET_FIRST_ARCHIVE_FLAG,
  PET_PHOTO_MAX_BYTES,
  PET_VIDEO_MAX_BYTES,
} from "./pet-first-archive.ts";

const migration = readFileSync("supabase/migration_pet_first_archive.sql", "utf8");
const rollback = readFileSync("supabase/rollback_pet_first_archive.sql", "utf8");
const petsRoute = readFileSync("app/api/my/pets/route.ts", "utf8");
const petRoute = readFileSync("app/api/my/pets/[petId]/route.ts", "utf8");
const photoRoute = readFileSync("app/api/my/pets/[petId]/photos/route.ts", "utf8");
const petProfileForm = readFileSync("components/pet-profile-form.tsx", "utf8");
const videoRoute = readFileSync("app/api/my/pets/[petId]/videos/route.ts", "utf8");
const memoryRoute = readFileSync("app/api/my/pets/[petId]/memories/route.ts", "utf8");
const petsPage = readFileSync("app/my/pets/page.tsx", "utf8");
const memoryPage = readFileSync("app/my/pets/[petId]/page.tsx", "utf8");
const home = readFileSync("components/pet-first-home.tsx", "utf8");
const memoryUi = readFileSync("components/pet-first-memory.tsx", "utf8");
const hero = readFileSync("components/homepage/hero.tsx", "utf8");
const legacyPhotos = readFileSync("app/api/life-archive/photos/route.ts", "utf8");

test("pet-first archive stays off unless the flag is exactly 1", () => {
  const previous = process.env[PET_FIRST_ARCHIVE_FLAG];
  try {
    delete process.env[PET_FIRST_ARCHIVE_FLAG];
    assert.equal(isPetFirstArchiveEnabled(), false);
    process.env[PET_FIRST_ARCHIVE_FLAG] = "true";
    assert.equal(isPetFirstArchiveEnabled(), false);
    process.env[PET_FIRST_ARCHIVE_FLAG] = "1";
    assert.equal(isPetFirstArchiveEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env[PET_FIRST_ARCHIVE_FLAG];
    else process.env[PET_FIRST_ARCHIVE_FLAG] = previous;
  }
});

test("a pet can be created from a name without a letter or a name merge", () => {
  const parsed = parsePetCreateInput({ petName: "보리", lifeStatus: "living" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const row = petInsertRow("user-1", parsed.value);
  assert.equal(row.pet_name, "보리");
  assert.equal(row.owner_user_id, "user-1");
  assert.equal("submission_id" in row, false);
  assert.match(petsRoute, /petInsertRow\(/);
  assert.match(petsRoute, /\.insert\(row\)/);
  assert.doesNotMatch(petsRoute, /soul_trace_submissions|generate-letter|onConflict/);
});

test("same names stay separate because create never looks pets up by name", () => {
  const first = parsePetCreateInput({ petName: "보리" });
  const second = parsePetCreateInput({ petName: "보리" });
  assert.equal(first.ok && second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.deepEqual(petInsertRow("user-1", first.value).pet_name, petInsertRow("user-2", second.value).pet_name);
  assert.doesNotMatch(petsRoute, /\.eq\("pet_name"/);
});

test("another account's pet id is not found and a missing session is unauthenticated", () => {
  assert.equal(decidePetAccess(null, "owner-1"), "unauthenticated");
  assert.equal(decidePetAccess("user-2", "owner-1"), "not_found");
  assert.equal(decidePetAccess("owner-1", null), "not_found");
  assert.equal(decidePetAccess("owner-1", "owner-1"), "ok");
});

test("photo and video limits match the existing archive rules", () => {
  assert.equal(validatePhotoFiles([{ type: "image/jpeg", size: 1 }]), "ok");
  assert.equal(validatePhotoFiles([{ type: "image/gif", size: 1 }]), "invalid_photos");
  assert.equal(validatePhotoFiles([{ type: "image/png", size: PET_PHOTO_MAX_BYTES + 1 }]), "invalid_photos");
  assert.equal(validatePhotoFiles(Array.from({ length: 6 }, () => ({ type: "image/webp", size: 1 }))), "invalid_photos");
  assert.equal(validateVideoFile({ type: "video/mp4", size: 1 }, 30, "", ""), "ok");
  assert.equal(validateVideoFile({ type: "video/mp4", size: PET_VIDEO_MAX_BYTES + 1 }, 10, "", ""), "invalid_video");
  assert.equal(validateVideoFile({ type: "video/mp4", size: 1 }, 31, "", ""), "invalid_video");
  assert.equal(validateVideoFile({ type: "video/avi", size: 1 }, 10, "", ""), "invalid_video");
});

test("a blank photo date is not treated as the day the photo was taken", () => {
  assert.equal(describeMemoryDate(null), "save-time-only");
  assert.equal(describeMemoryDate("2020-01-02"), "owner-entered");
  assert.equal(parsePetCreateInput({ petName: "보리", birthday: "2026-02-31" }).ok, false);
  assert.match(photoRoute, /form\.getAll\("photoDates"\)/);
  assert.match(photoRoute, /requireOwnedPet\(petId\)/);
  assert.match(photoRoute, /persistDatedPhotoBatch/);
  assert.match(photoRoute, /\.in\("entry_id", entryIds\)/);
  assert.match(petProfileForm, /upload\.set\("photos", photo\)/);
});

test("photo API remains compatible with legacy single-date and profile-photo callers", () => {
  assert.match(photoRoute, /parsePhotoBatchDates\(caption, submittedDates, legacyDate, files\.length\)/);
  assert.match(photoRoute, /storage\.from\("life-archive-photos"\)\.remove\(uploaded\)/);
  assert.match(petProfileForm, /fetch\(`\/api\/my\/pets\/\$\{saved\.petId\}\/photos`/);
});

test("text memories require an owner-written story and stay private in the route", () => {
  assert.equal(parseTextMemory({ story: "  오늘 창가에 앉았다.  " }).ok, true);
  assert.equal(parseTextMemory({ story: "   " }).ok, false);
  assert.match(memoryRoute, /visibility: "private"/);
  assert.doesNotMatch(memoryRoute, /visibility: body|visibility: record/);
});

test("storage paths stay inside the signed-in owner's folder", () => {
  const path = petFirstStoragePath({
    userId: "user-1",
    petId: "11111111-1111-4111-8111-111111111111",
    entryId: "22222222-2222-4222-8222-222222222222",
    assetId: "33333333-3333-4333-8333-333333333333",
    extension: "jpg",
  });
  assert.equal(isOwnerStoragePath(path, "user-1"), true);
  assert.equal(isOwnerStoragePath(path, "user-2"), false);
  assert.equal(isOwnerStoragePath("../user-1/secret", "user-1"), false);
});

test("the migration adds a letter-free timeline without dropping existing archive rows", () => {
  assert.match(migration, /create table if not exists public\.pet_timeline_entries/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /owner_user_id = auth\.uid\(\)/);
  assert.match(migration, /check \(life_status in \('living', 'memorial', 'unspecified'\)\)/);
  const entriesTable = migration.slice(
    migration.indexOf("create table if not exists public.pet_timeline_entries"),
    migration.indexOf("create table if not exists public.pet_timeline_assets"),
  );
  assert.doesNotMatch(entriesTable, /submission_id/);
  assert.doesNotMatch(migration, /drop table public\.soul_trace/i);
  assert.doesNotMatch(migration, /drop table public\.life_archive/i);
  assert.match(rollback, /drop table if exists public\.pet_timeline_entries/);
  assert.doesNotMatch(rollback, /drop table if exists public\.soul_trace_pets/i);
  assert.doesNotMatch(rollback, /drop table if exists public\.life_archive/i);
});

test("new routes authenticate the session user and leave the legacy photo route on submissions", () => {
  for (const source of [petsRoute, petRoute, photoRoute, videoRoute, memoryRoute]) {
    assert.match(source, /requirePetFirstUser|requireOwnedPet/);
    assert.doesNotMatch(source, /generate-letter|owner_user_id:\s*body|ownerUserId/);
  }
  assert.match(petsPage, /isPetFirstArchiveEnabled\(\)/);
  assert.match(petsPage, /notFound\(\)/);
  assert.match(petsPage, /authEntryPath\("\/my\/pets"\)/);
  assert.match(memoryPage, /notFound\(\)/);
  assert.doesNotMatch(petRoute, /soul_trace_submissions|\.delete\(/);
  assert.match(legacyPhotos, /submission_id/);
  assert.doesNotMatch(`${home}\n${memoryUi}`, /sessionStorage|indexedDB|localStorage/);
});

test("homepage letter links remain when the pet-first flag is off", () => {
  assert.match(hero, /isPetFirstArchiveEnabled\(\)/);
  assert.match(hero, /href=\{choiceHref\}/);
  assert.match(hero, /t\("homepage\.hero\.primary"\)/);
  assert.doesNotMatch(hero, /href=["']\/(?:choose|living|memorial)/);
});

test("favorites stay in the existing traits column and never invent a status from letter mode", () => {
  assert.deepEqual(splitPetNotes("온순함\n◆ 공놀이"), { personality: "온순함", favorites: "공놀이" });
  assert.equal(joinPetNotes("온순함", "공놀이"), "온순함\n◆ 공놀이");
  const created = parsePetCreateInput({ petName: "보리", traits: "온순함", favorites: "공놀이" });
  assert.equal(created.ok, true);
  if (created.ok) assert.equal(created.value.lifeStatus, "unspecified");
  const statusOnly = parsePetPatchInput({ lifeStatus: "memorial" });
  assert.equal(statusOnly.ok, true);
  if (statusOnly.ok) {
    assert.equal(statusOnly.value.lifeStatus, "memorial");
    assert.equal("traits" in statusOnly.value, false);
    assert.deepEqual(petPatchRow(statusOnly.value, "2026-11-01T00:00:00Z").life_status, "memorial");
  }
  assert.equal(isMissingRelationError("PGRST205"), true);
  assert.equal(isMissingRelationError("42P01"), true);
  assert.equal(isMissingRelationError("42703"), false);
  assert.match(readFileSync("lib/pet-first-archive-data.ts", "utf8"), /skipPetTimelineQuery|isMissingRelationError/);
  assert.match(readFileSync("lib/pet-first-archive-data.ts", "utf8"), /loadOwnedPetRows/);
  assert.doesNotMatch(
    readFileSync("lib/pet-first-archive-data.ts", "utf8").slice(
      readFileSync("lib/pet-first-archive-data.ts", "utf8").indexOf("export async function pickOwnedPet"),
    ),
    /loadPetHome/,
  );
  assert.match(memoryRoute, /isMissingRelationError/);
  assert.equal(letterPathForLifeStatus("living", "pet-1"), "/living?petId=pet-1");
  assert.equal(letterPathForLifeStatus("memorial", "pet-1"), "/memorial?petId=pet-1");
  assert.equal(letterPathForLifeStatus("unspecified", "pet-1"), "/choose?petId=pet-1");
  assert.doesNotMatch(readFileSync("components/customer-dashboard.tsx", "utf8"), /letterMode|infer|추정/);
});

test("P1 customer home, profile, memories, and settings stay on existing auth and archive routes", () => {
  const dashboardPage = readFileSync("app/dashboard/page.tsx", "utf8");
  const dashboardUi = readFileSync("components/customer-dashboard.tsx", "utf8");
  const settingsPage = readFileSync("app/settings/page.tsx", "utf8");
  const settingsUi = readFileSync("components/account-settings.tsx", "utf8");
  const newPet = readFileSync("app/my/pets/new/page.tsx", "utf8");
  const editPet = readFileSync("app/my/pets/[petId]/edit/page.tsx", "utf8");
  const profileForm = readFileSync("components/pet-profile-form.tsx", "utf8");
  const tabRoutes = readFileSync("lib/story-tabs.ts", "utf8");

  assert.match(dashboardPage, /dashboardHomePath/);
  assert.match(dashboardPage, /redirect\("\/choose"\)/);
  assert.match(readFileSync("app/dashboard/living/page.tsx", "utf8"), /LivingHome/);
  assert.match(readFileSync("app/dashboard/memorial/page.tsx", "utf8"), /MemorialHome/);
  assert.match(readFileSync("components/living-home.tsx", "utf8"), /\/create\?/);
  assert.match(readFileSync("components/living-home.tsx", "utf8"), /\/my\/device/);
  assert.doesNotMatch(readFileSync("components/living-home.tsx", "utf8"), /memorial-space|mood-journal/);
  assert.match(readFileSync("components/memorial-home.tsx", "utf8"), /memorial-space/);
  assert.match(readFileSync("components/memorial-space.tsx", "utf8"), /moodJournalHref/);
  assert.doesNotMatch(readFileSync("components/memorial-home.tsx", "utf8"), /\/my\/device|산책 시작|mood-journal/);
  assert.match(dashboardUi, /letterPathForLifeStatus/);
  assert.match(dashboardUi, /copy\.walkTitle/);
  assert.match(dashboardUi, /memorialSpaceHref/);
  assert.match(dashboardUi, /moodJournalHref/);
  assert.match(dashboardUi, /copy\.branchTitle/);
  assert.match(dashboardUi, /lifeStatus: next/);
  assert.doesNotMatch(dashboardUi, /시작하기|GPS|목걸이 구매/);
  assert.doesNotMatch(dashboardUi, /battery|wifi|status-bar|screens_live/i);

  assert.match(newPet, /PetProfileForm/);
  assert.match(editPet, /loadPetProfile/);
  assert.match(profileForm, /name="lifeStatus"/);
  assert.match(profileForm, /name="favorites"/);
  assert.match(profileForm, /defaultChecked=\{\(initial\?\.lifeStatus \?\? "unspecified"\) === value\}/);

  assert.match(memoryUi, /copy\.memoryTabRecord/);
  assert.match(memoryUi, /copy\.memoryTabCollection/);
  assert.match(memoryUi, /copy\.memoryTabTogether/);
  assert.match(readFileSync("components/pet-profile-form.tsx", "utf8"), /copy\.savePetError/);
  assert.match(readFileSync("lib/storybook-copy.ts", "utf8"), /프로필 사진은 없어도 됩니다/);
  assert.match(memoryUi, /\/api\/my\/pets\/\$\{petId\}\/memories/);
  assert.match(memoryUi, /memorialSpaceHref|moodJournalHref/);
  assert.doesNotMatch(memoryUi, /href=["']\/family/);

  assert.match(settingsPage, /AccountSettings/);
  assert.match(settingsUi, /signOut/);
  assert.match(settingsUi, /\/privacy-policy/);
  assert.match(settingsUi, /\/terms-of-service/);
  assert.match(settingsUi, /copy\.settingsNotifyMonthly/);
  assert.match(settingsUi, /copy\.off/);
  assert.match(settingsUi, /copy\.soon/);
  assert.doesNotMatch(settingsUi, /Apple|Google|OAuth|signInWithOAuth|checkout|tosspayments/i);

  assert.match(tabRoutes, /\/dashboard\/living\$\{petQuery\}/);
  assert.match(tabRoutes, /\/dashboard\/memorial\$\{petQuery\}/);
  assert.match(tabRoutes, /pet: "\/my\/pets"/);
  assert.match(tabRoutes, /`\/my\/pets\/\$\{encodeURIComponent\(petId\)\}\/memories#album`/);
  assert.match(readFileSync("app/memories/page.tsx", "utf8"), /loadPetHome/);
  assert.doesNotMatch(readFileSync("app/memories/page.tsx", "utf8"), /LifeArchiveAccessRequired|eternal-beam-access/);
  assert.match(petsPage, /PetRoster/);
  assert.doesNotMatch(petsPage, /PetFirstHome/);
  assert.match(readFileSync("components/pet-roster.tsx", "utf8"), /current="pet"/);
  assert.match(memoryUi, /current="memories"/);
  assert.match(petRoute, /requireOwnedPet/);
  assert.match(petRoute, /\.eq\("owner_user_id", access\.user\.id\)/);
  assert.doesNotMatch(petsRoute, /\.delete\(/);
  assert.doesNotMatch(petRoute, /\.delete\(/);
});
