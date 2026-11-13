import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authorizeMemoryPolaroidPhoto,
  beamDualDisplay,
  beamSceneHref,
  canOpenCollar,
  canOpenMemorialSpace,
  createBeamSceneDraft,
  decideDeviceAccess,
  decideMemorialSpaceAccess,
  deviceHref,
  flattenYearFoldersNewestFirst,
  groupLibraryIntoYearFolders,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  memorialSpaceHref,
  memoriesMonthHref,
  memoryPatchRow,
  monthFolderCoverUrl,
  moodJournalHref,
  MOOD_JOURNAL_TITLE,
  NATIVE_PHOTO_SYNC,
  parseMemoryPatch,
  parseMoodJournalBody,
  polaroidHrefFromArchive,
  readOptionalMemoryRows,
  signAvailableMemoryAssets,
  splitBeamAssets,
  type MemoryLibraryItem,
} from "./memory-library.ts";

function item(partial: Partial<MemoryLibraryItem> & Pick<MemoryLibraryItem, "entryId" | "happenedOn" | "createdAt">): MemoryLibraryItem {
  return {
    kind: "photo",
    title: null,
    story: null,
    place: null,
    favorite: false,
    origin: "pet_first",
    deletable: true,
    assets: [],
    ...partial,
  };
}

test("photos group by capture month then the same calendar day", () => {
  const groups = groupLibraryByMonthAndDay([
    item({ entryId: "a", happenedOn: "2026-10-02", createdAt: "2026-10-02T10:00:00Z" }),
    item({ entryId: "b", happenedOn: "2026-10-02", createdAt: "2026-10-02T12:00:00Z" }),
    item({ entryId: "c", happenedOn: "2026-09-30", createdAt: "2026-09-30T09:00:00Z" }),
    item({ entryId: "d", happenedOn: null, createdAt: "2026-10-03T08:00:00Z" }),
  ]);
  assert.deepEqual(groups.map((month) => month.key), ["2026-10", "2026-09"]);
  assert.deepEqual(groups[0].days.map((day) => day.key), ["2026-10-03", "2026-10-02"]);
  assert.deepEqual(groups[0].days[1].items.map((entry) => entry.entryId), ["b", "a"]);
  assert.equal(memoriesMonthHref("pet-1", "2026-10"), "/memories?pet=pet-1&view=months&month=2026-10");
  assert.equal(memoriesMonthHref(null), "/memories?view=months");
});

test("memory folders group actual records by year and month and retain the saved-date fallback", () => {
  const folders = groupLibraryIntoYearFolders([
    item({ entryId: "captured-a", happenedOn: "2026-10-02", createdAt: "2026-11-01T10:00:00Z" }),
    item({ entryId: "captured-b", happenedOn: "2026-10-02", createdAt: "2026-11-01T11:00:00Z" }),
    item({ entryId: "saved-date", happenedOn: null, createdAt: "2026-09-30T09:00:00Z" }),
    item({ entryId: "older", happenedOn: "2025-12-01", createdAt: "2025-12-01T09:00:00Z" }),
  ]);

  assert.deepEqual(folders.map((year) => year.year), ["2026", "2025"]);
  assert.deepEqual(folders[0].months.map(({ key, count }) => [key, count]), [["2026-10", 2], ["2026-09", 1]]);
  assert.equal(folders[0].months[1].days[0].items[0].entryId, "saved-date");
  assert.deepEqual(folders[1].months.map(({ key, count }) => [key, count]), [["2025-12", 1]]);
  assert.deepEqual(flattenYearFoldersNewestFirst(folders).map(({ key }) => key), ["2026-10", "2026-09", "2025-12"]);
});

test("month folder cover uses an available photo and stays empty when a month has no photo", () => {
  const [folder] = groupLibraryIntoYearFolders([
    item({
      entryId: "video-only",
      happenedOn: "2026-10-02",
      createdAt: "2026-10-02T10:00:00Z",
      assets: [{ assetId: "video", url: "/signed-video", contentType: "video/mp4", order: 0 }],
    }),
    item({
      entryId: "photo",
      happenedOn: "2026-10-01",
      createdAt: "2026-10-01T10:00:00Z",
      assets: [{ assetId: "photo", url: "/signed-photo", contentType: "image/jpeg", order: 0 }],
    }),
    item({
      entryId: "other-month",
      happenedOn: "2026-09-01",
      createdAt: "2026-09-01T10:00:00Z",
      assets: [{ assetId: "other-photo", url: "/other-photo", contentType: "image/jpeg", order: 0 }],
    }),
  ]);

  assert.equal(monthFolderCoverUrl(folder.months[0]), "/signed-photo");
  assert.equal(monthFolderCoverUrl(folder.months[1]), "/other-photo");
  assert.equal(monthFolderCoverUrl({ ...folder.months[0], days: [{ key: "2026-10-02", items: [folder.months[0].days[0].items[0]] }] }), null);
});

test("one private asset signing failure leaves other signed memories available", async () => {
  const privatePath = "owner/pet/path/private-photo.jpg";
  const result = await signAvailableMemoryAssets([
    { asset_id: "asset-a", storage_bucket: "life-archive-photos", storage_path: privatePath, content_type: "image/jpeg", asset_order: 0 },
    { asset_id: "asset-b", storage_bucket: "life-archive-photos", storage_path: "owner/pet/path/unavailable.jpg", content_type: "image/jpeg", asset_order: 1 },
    { asset_id: "asset-c", storage_bucket: "life-archive-photos", storage_path: "owner/pet/path/permission-denied.jpg", content_type: "image/jpeg", asset_order: 2 },
    { asset_id: "asset-d", storage_bucket: "life-archive-photos", storage_path: "owner/pet/path/available.jpg", content_type: "image/png", asset_order: 3 },
  ], async (asset) => {
    if (asset.asset_id === "asset-b") throw new Error("storage unavailable");
    if (asset.asset_id === "asset-c") return { url: null, error: { code: "not_found" } };
    return { url: `https://signed.example/${asset.asset_id}` };
  });

  assert.equal(result.failedCount, 2);
  assert.deepEqual(result.assets.map((asset) => asset.assetId), ["asset-a", "asset-d"]);
  assert.equal(JSON.stringify(result).includes(privatePath), false);
});

test("optional Letter and Polaroid reads report failures without throwing away caller control", async () => {
  assert.deepEqual(await readOptionalMemoryRows(async () => ({ data: [{ id: 1 }], error: null })), {
    rows: [{ id: 1 }],
    errorCode: null,
  });
  assert.deepEqual(await readOptionalMemoryRows(async () => ({ data: null, error: { code: "42501" } })), {
    rows: [],
    errorCode: "42501",
  });
  assert.deepEqual(await readOptionalMemoryRows(async () => { throw new Error("offline"); }), {
    rows: [],
    errorCode: "read_failed",
  });
});

test("memory patches accept story edits and preserve the other editable fields", () => {
  const parsed = parseMemoryPatch({ title: "창가", story: "  A quiet day together.  ", place: "집", happenedOn: "2026-03-01", favorite: true });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(memoryPatchRow(parsed.value, "2026-11-01T00:00:00Z"), {
    title: "창가",
    story: "A quiet day together.",
    place: "집",
    happened_on: "2026-03-01",
    favorite: true,
    updated_at: "2026-11-01T00:00:00Z",
  });
  assert.equal(parseMemoryPatch({ story: "  " }).ok, true);
  assert.equal(parseMemoryPatch({ story: "x".repeat(2001) }).ok, false);
  assert.equal(parseMemoryPatch({ happenedOn: "2026-02-31" }).ok, false);
  assert.equal(parseMemoryPatch({ favorite: "yes" }).ok, false);
});

test("memorial space and collar menus stay status-gated and owner-only", () => {
  assert.equal(canOpenMemorialSpace("memorial"), true);
  assert.equal(canOpenMemorialSpace("living"), false);
  assert.equal(canOpenCollar("living"), true);
  assert.equal(canOpenCollar("unspecified"), true);
  assert.equal(canOpenCollar("memorial"), false);
  assert.equal(decideMemorialSpaceAccess(null, "owner", "memorial"), "unauthenticated");
  assert.equal(decideMemorialSpaceAccess("other", "owner", "memorial"), "not_found");
  assert.equal(decideMemorialSpaceAccess("owner", "owner", "living"), "not_memorial");
  assert.equal(decideMemorialSpaceAccess("owner", "owner", "memorial"), "ok");
  assert.equal(decideDeviceAccess("owner", "owner", "living"), "ok");
  assert.equal(decideDeviceAccess("owner", "owner", "unspecified"), "ok");
  assert.equal(decideDeviceAccess("owner", "owner", "memorial"), "not_living");
  assert.equal(memorialSpaceHref("pet-1"), "/memorial-space?pet=pet-1");
  assert.equal(moodJournalHref("pet-1"), "/mood-journal?pet=pet-1");
  assert.equal(deviceHref("pet-1"), "/my/device?pet=pet-1");
  assert.equal(polaroidHrefFromArchive("pet-1"), "/polaroid?petId=pet-1");
  assert.equal(beamSceneHref("pet-1", "entry-1", "asset-1"), "/beam-scene?pet=pet-1&entry=entry-1&asset=asset-1");
});

test("a Memories photo handoff accepts only the requested owner's pet image", () => {
  const expected = { assetId: "asset-1", entryId: "entry-1", ownerUserId: "owner-1", petId: "pet-1" };
  const source = {
    ...expected,
    storageBucket: "life-archive-photos",
    storagePath: "owner-1/pet-1/photo.jpg",
    contentType: "image/jpeg",
  };

  assert.deepEqual(authorizeMemoryPolaroidPhoto(source, expected), source);
  assert.equal(authorizeMemoryPolaroidPhoto({ ...source, ownerUserId: "other-owner" }, expected), null);
  assert.equal(authorizeMemoryPolaroidPhoto({ ...source, petId: "other-pet" }, expected), null);
  assert.equal(authorizeMemoryPolaroidPhoto({ ...source, entryId: "other-entry" }, expected), null);
  assert.equal(authorizeMemoryPolaroidPhoto({ ...source, contentType: "video/mp4" }, expected), null);
  assert.equal(authorizeMemoryPolaroidPhoto(null, expected), null);
  assert.equal(polaroidHrefFromArchive("pet-1", "entry-1", "asset-1"), "/polaroid?petId=pet-1&memoryEntryId=entry-1&memoryAssetId=asset-1");
  assert.equal(polaroidHrefFromArchive("pet-1", "entry-1"), "/polaroid?petId=pet-1");
});

test("mood journal stays private and beam scenes keep originals apart from derivatives", () => {
  assert.equal(parseMoodJournalBody({ story: "보고 싶다" }).ok, true);
  assert.equal(parseMoodJournalBody({ story: "   " }).ok, false);
  assert.equal(isMoodJournalItem({ kind: "text", title: MOOD_JOURNAL_TITLE }), true);
  const scene = createBeamSceneDraft({ petId: "pet-1", place: "park", originalUrl: "/orig.jpg", derivativeUrl: "/ai.jpg" });
  const dual = beamDualDisplay(scene);
  assert.equal(dual.hardwarePlayback, false);
  assert.equal(dual.transferEnabled, false);
  assert.equal(dual.originalPreserved, true);
  assert.deepEqual(splitBeamAssets("/orig.jpg", "/orig.jpg"), { original: "/orig.jpg", derivative: null });
  assert.equal(NATIVE_PHOTO_SYNC.web, "manual_picker_only");
});

test("new SQL and routes stay additive and do not replace /memorial letter generation", () => {
  const migration = readFileSync("supabase/migration_memory_library.sql", "utf8");
  const rollback = readFileSync("supabase/rollback_memory_library.sql", "utf8");
  const memories = readFileSync("app/api/my/pets/[petId]/memories/route.ts", "utf8");
  const mood = readFileSync("app/api/my/pets/[petId]/mood-journal/route.ts", "utf8");
  const beam = readFileSync("app/api/my/pets/[petId]/beam-scenes/route.ts", "utf8");
  const memorialPage = readFileSync("app/memorial/page.tsx", "utf8");
  const memorialSpace = readFileSync("app/memorial-space/page.tsx", "utf8");
  const letter = readFileSync("app/living/page.tsx", "utf8");

  assert.match(migration, /create table if not exists public\.pet_mood_journal/);
  assert.match(migration, /visibility = 'private'/);
  assert.match(migration, /life_status = 'memorial'/);
  assert.match(migration, /create table if not exists public\.beam_scene_previews/);
  assert.match(migration, /playback_ready = false/);
  assert.doesNotMatch(migration, /drop table public\.soul_trace|drop table public\.life_archive|drop table public\.pet_timeline/i);
  assert.match(rollback, /drop table if exists public\.pet_mood_journal/);
  assert.doesNotMatch(rollback, /drop table if exists public\.pet_timeline_entries/);

  assert.match(memories, /export async function PATCH/);
  assert.match(mood, /requireMemorialPet/);
  assert.match(mood, /visibility: "private"/);
  assert.match(beam, /hardwarePlayback: false/);
  assert.match(memorialPage, /SoulTraceFlow mode="memorial"/);
  assert.match(memorialSpace, /MemorialSpace/);
  assert.match(letter, /SoulTraceFlow/);
  assert.doesNotMatch(memorialSpace, /SoulTraceFlow/);
});

test("archive, memorial-space, device and beam pages stay behind the pet-first flag", () => {
  for (const path of [
    "app/memorial-space/page.tsx",
    "app/mood-journal/page.tsx",
    "app/beam-scene/page.tsx",
    "app/my/device/page.tsx",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /isPetFirstArchiveEnabled\(\)/);
    assert.match(source, /notFound\(\)/);
    assert.doesNotMatch(source, /authEntryPath/);
  }
  const memoryUi = readFileSync("components/pet-first-memory.tsx", "utf8");
  const petProfile = readFileSync("components/pet-first-profile.tsx", "utf8");
  const roster = readFileSync("components/pet-roster.tsx", "utf8");
  assert.match(petProfile, /canOpenMemorialSpace\(profile\.lifeStatus\)/);
  assert.doesNotMatch(memoryUi, /\/my\/device\?pet=/);
  assert.match(roster, /lifeStatus === "living"[\s\S]*\/my\/device\?pet=/);
  assert.doesNotMatch(memoryUi, /href=["']\/my\/collar["']/);
  const collar = readFileSync("components/collar-studio.tsx", "utf8");
  assert.match(collar, /connected \? "예시" : "--"/);
  assert.doesNotMatch(collar, /4,820|1\.8km/);
});
