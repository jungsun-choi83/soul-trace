import assert from "node:assert/strict";
import test from "node:test";

import { parsePhotoBatchDates, persistDatedPhotoBatch, resolvePhotoBatchDates } from "./photo-batch.ts";
import { groupLibraryIntoYearFolders } from "./memory-library.ts";

test("a batch accepts individual capture dates and blank dates for save-time fallback", () => {
  assert.deepEqual(parsePhotoBatchDates("Walk", ["2020-04-05", "2022-11-19", ""], "", 3), {
    ok: true,
    caption: "Walk",
    happenedOn: ["2020-04-05", "2022-11-19", null],
  });
});

test("the simple photo form date overrides EXIF dates, otherwise each EXIF date is retained", () => {
  const photos = [{ name: "one.jpg" }, { name: "two.jpg" }, { name: "three.jpg" }];
  const detected = ["2020-04-05", null, "2022-11-19"];
  assert.deepEqual(resolvePhotoBatchDates(photos, detected, "2024-06-07"), [
    "2024-06-07",
    "2024-06-07",
    "2024-06-07",
  ]);
  assert.deepEqual(resolvePhotoBatchDates(photos, detected, ""), [
    "2020-04-05",
    "",
    "2022-11-19",
  ]);
});

test("a user-corrected date is what the API persists and malformed date lists are rejected", () => {
  assert.deepEqual(parsePhotoBatchDates("", ["2020-04-06"], "", 1), {
    ok: true,
    caption: null,
    happenedOn: ["2020-04-06"],
  });
  assert.deepEqual(parsePhotoBatchDates("", ["2020-04-06"], "", 2), { ok: false });
  assert.deepEqual(parsePhotoBatchDates("", ["2020-02-30"], "", 1), { ok: false });
});

test("legacy callers still apply one shared optional date to their submitted files", () => {
  assert.deepEqual(parsePhotoBatchDates("Profile", [], "2020-04-05", 2), {
    ok: true,
    caption: "Profile",
    happenedOn: ["2020-04-05", "2020-04-05"],
  });
  assert.deepEqual(parsePhotoBatchDates("Profile", [], "", 1), {
    ok: true,
    caption: "Profile",
    happenedOn: [null],
  });
});

test("dated batches create one timeline entry per photo with its own capture date", async () => {
  const createdDates: (string | null)[] = [];
  const result = await persistDatedPhotoBatch([
    { file: "photo-a", happenedOn: "2020-04-05" },
    { file: "photo-b", happenedOn: "2022-11-19" },
    { file: "photo-c", happenedOn: null },
  ], {
    async createEntry(photo, index) {
      createdDates.push(photo.happenedOn);
      return { entryId: `entry-${index}` };
    },
    async uploadAndLink(_entry, _photo, index, onUploaded) { onUploaded(`object-${index}`); },
    async rollback() { assert.fail("successful batch must not roll back"); },
  });
  assert.deepEqual(createdDates, ["2020-04-05", "2022-11-19", null]);
  assert.deepEqual(result, { ok: true, entryIds: ["entry-0", "entry-1", "entry-2"] });
});

test("saved per-photo dates feed their existing year/month/day folders", () => {
  const folders = groupLibraryIntoYearFolders([
    { happenedOn: "2020-04-05", createdAt: "2026-11-11T10:00:00Z", entryId: "photo-a" },
    { happenedOn: "2022-11-19", createdAt: "2026-11-11T10:01:00Z", entryId: "photo-b" },
    { happenedOn: null, createdAt: "2026-11-11T10:02:00Z", entryId: "photo-c" },
  ]);
  assert.deepEqual(folders.flatMap((year) => year.months.map((month) => month.key)), ["2026-11", "2022-11", "2020-04"]);
  assert.deepEqual(folders.flatMap((year) => year.months.map((month) => month.count)), [1, 1, 1]);
});

test("failed upload cleans previously uploaded objects and every created entry", async () => {
  const rolledBack: { entries: string[]; objects: string[] }[] = [];
  const result = await persistDatedPhotoBatch([
    { file: "photo-a", happenedOn: "2020-04-05" },
    { file: "photo-b", happenedOn: "2022-11-19" },
  ], {
    async createEntry(_photo, index) { return { entryId: `entry-${index}` }; },
    async uploadAndLink(_entry, _photo, index, onUploaded) {
      if (index === 0) onUploaded("object-0");
      else throw new Error("storage upload failed");
    },
    async rollback(entries, objects) { rolledBack.push({ entries, objects }); },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.stage, "upload");
  assert.deepEqual(rolledBack, [{ entries: ["entry-0", "entry-1"], objects: ["object-0"] }]);
});

test("entry creation failure rolls back all earlier entries and objects", async () => {
  const rollback: string[][] = [];
  const result = await persistDatedPhotoBatch([
    { file: "photo-a", happenedOn: "2020-04-05" },
    { file: "photo-b", happenedOn: "2022-11-19" },
  ], {
    async createEntry(_photo, index) {
      if (index === 1) throw new Error("database insert failed");
      return { entryId: "entry-0" };
    },
    async uploadAndLink(_entry, _photo, _index, onUploaded) { onUploaded("object-0"); },
    async rollback(entries, objects) { rollback.push([...entries, ...objects]); },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.stage, "entry");
  assert.deepEqual(rollback, [["entry-0", "object-0"]]);
});
