import assert from "node:assert/strict";
import test from "node:test";

import { currentUploadDate, groupPhotosForMonthPreview } from "./photo-sort-preview.ts";

test("valid detected dates determine each photo's destination month", () => {
  const preview = groupPhotosForMonthPreview([
    { id: "jan-photo", happenedOn: "2020-01-31" },
    { id: "feb-photo", happenedOn: "2020-02-01" },
  ], "2026-11-11");
  assert.deepEqual(preview.map((group) => [group.monthKey, group.count]), [["2020-02", 1], ["2020-01", 1]]);
});

test("missing or invalid dates use the upload-date month without guessing a capture date", () => {
  const preview = groupPhotosForMonthPreview([
    { id: "missing", happenedOn: "" },
    { id: "invalid", happenedOn: "2021-02-30" },
  ], "2026-11-11");
  assert.equal(preview.length, 1);
  assert.equal(preview[0]?.monthKey, "2026-11");
  assert.equal(preview[0]?.count, 2);
});

test("optional date adjustments move only the corrected photos between month previews", () => {
  const preview = groupPhotosForMonthPreview([
    { id: "corrected", happenedOn: "2024-03-01" },
    { id: "unchanged", happenedOn: "2024-02-28" },
    { id: "no-metadata", happenedOn: "" },
  ], "2026-11-11");
  assert.deepEqual(preview.map((group) => [group.monthKey, group.count]), [
    ["2026-11", 1],
    ["2024-03", 1],
    ["2024-02", 1],
  ]);
});

test("save-date fallback matches the timeline's ISO date fallback", () => {
  assert.equal(currentUploadDate(new Date("2026-11-11T23:59:00.000Z")), "2026-11-11");
});
