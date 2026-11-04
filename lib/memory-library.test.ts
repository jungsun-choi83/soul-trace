import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  beamDualDisplay,
  beamSceneHref,
  canOpenCollar,
  canOpenMemorialSpace,
  createBeamSceneDraft,
  decideDeviceAccess,
  decideMemorialSpaceAccess,
  deviceHref,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  memorialSpaceHref,
  memoryPatchRow,
  moodJournalHref,
  MOOD_JOURNAL_TITLE,
  NATIVE_PHOTO_SYNC,
  parseMemoryPatch,
  parseMoodJournalBody,
  polaroidHrefFromArchive,
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
});

test("memory patches accept owner-entered date, title, place and favorite", () => {
  const parsed = parseMemoryPatch({ title: "창가", place: "집", happenedOn: "2026-03-01", favorite: true });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(memoryPatchRow(parsed.value, "2026-11-01T00:00:00Z"), {
    title: "창가",
    place: "집",
    happened_on: "2026-03-01",
    favorite: true,
    updated_at: "2026-11-01T00:00:00Z",
  });
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
    assert.match(source, /authEntryPath/);
  }
  const memoryUi = readFileSync("components/pet-first-memory.tsx", "utf8");
  assert.match(memoryUi, /canOpenCollar\(status\)/);
  assert.match(memoryUi, /\/my\/device\?pet=/);
  assert.doesNotMatch(memoryUi, /href=["']\/my\/collar["']/);
  const collar = readFileSync("components/collar-studio.tsx", "utf8");
  assert.match(collar, /connected \? "예시" : "--"/);
  assert.doesNotMatch(collar, /4,820|1\.8km/);
});
