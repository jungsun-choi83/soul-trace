import assert from "node:assert/strict";
import test from "node:test";

import {
  downloadSeasonalPolaroidResultImage,
  seasonalPolaroidResultPath,
  isSeasonalPolaroidResultPath,
  uploadSeasonalPolaroidResultImage,
  type SeasonalPolaroidResultStorage,
} from "./seasonal-polaroid-result-storage.ts";

const JOB_ID = "a".repeat(64);
const ATTEMPT_ID = "b".repeat(32);

test("Seasonal result paths are private and job-owned", () => {
  assert.equal(
    seasonalPolaroidResultPath(JOB_ID, ATTEMPT_ID),
    `seasonal-polaroid/${JOB_ID}/result/${ATTEMPT_ID}.jpg`,
  );
  assert.throws(() => seasonalPolaroidResultPath("not-a-job", ATTEMPT_ID));
  const attemptPath = seasonalPolaroidResultPath(JOB_ID, ATTEMPT_ID);
  assert.equal(isSeasonalPolaroidResultPath(JOB_ID, attemptPath), true);
  assert.equal(isSeasonalPolaroidResultPath("c".repeat(64), attemptPath), false);
});

test("result upload does not overwrite another result and download stays bucket-private", async () => {
  const uploads: Array<{ path: string; upsert: boolean }> = [];
  const bucket = {
    upload: async (path: string, _body: ArrayBuffer, options: { upsert: boolean }) => {
      uploads.push({ path, upsert: options.upsert });
      return { error: null };
    },
    download: async () => ({ data: new Blob([new Uint8Array([1, 2, 3])]), error: null }),
  };
  const storage: SeasonalPolaroidResultStorage = { storage: { from: () => bucket } };
  const path = seasonalPolaroidResultPath(JOB_ID, ATTEMPT_ID);
  assert.deepEqual(await uploadSeasonalPolaroidResultImage({ storage, objectKey: path, bytes: new ArrayBuffer(3) }), { ok: true });
  assert.deepEqual(uploads, [{ path, upsert: false }]);
  assert.equal((await downloadSeasonalPolaroidResultImage({ storage, objectKey: path }))?.size, 3);
});
