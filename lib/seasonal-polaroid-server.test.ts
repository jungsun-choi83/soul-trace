import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  detectSeasonalPolaroidPhotoFormat,
  validateSeasonalPolaroidPhotoContent,
} from "./seasonal-polaroid-photo-server.ts";
import {
  cleanupSeasonalPolaroidInputs,
  seasonalPolaroidInputPaths,
  uploadSeasonalPolaroidInputs,
  type SeasonalPolaroidStorage,
} from "./seasonal-polaroid-input-storage.ts";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const JOB_ID = "a".repeat(64);
const ATTEMPT_A = "attempt-a-123456";
const ATTEMPT_B = "attempt-b-123456";

test("detects JPEG, PNG, and WebP from signatures", () => {
  assert.equal(detectSeasonalPolaroidPhotoFormat(JPEG), "image/jpeg");
  assert.equal(detectSeasonalPolaroidPhotoFormat(PNG), "image/png");
  assert.equal(detectSeasonalPolaroidPhotoFormat(WEBP), "image/webp");
  assert.equal(detectSeasonalPolaroidPhotoFormat(new Uint8Array([1, 2, 3])), null);
});

test("rejects MIME/signature and extension/signature mismatches", () => {
  assert.equal(
    validateSeasonalPolaroidPhotoContent(
      { name: "pet.png", type: "image/png", size: JPEG.byteLength },
      JPEG,
      "primaryPhoto",
    )?.code,
    "photo_signature",
  );
  assert.equal(
    validateSeasonalPolaroidPhotoContent(
      { name: "pet.gif", type: "image/jpeg", size: JPEG.byteLength },
      JPEG,
      "primaryPhoto",
    )?.code,
    "photo_signature",
  );
});

test("explicitly rejects HEIC/HEIF and oversized content", () => {
  assert.equal(
    validateSeasonalPolaroidPhotoContent(
      { name: "pet.heic", type: "image/heic", size: JPEG.byteLength },
      JPEG,
      "primaryPhoto",
    )?.code,
    "photo_heic",
  );
  assert.equal(
    validateSeasonalPolaroidPhotoContent(
      { name: "pet.jpg", type: "image/jpeg", size: 15 * 1024 * 1024 + 1 },
      JPEG,
      "secondaryPhoto",
    )?.code,
    "photo_size",
  );
  const heif = new Uint8Array([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  assert.equal(
    validateSeasonalPolaroidPhotoContent(
      { name: "pet.bin", type: "application/octet-stream", size: heif.byteLength },
      heif,
      "primaryPhoto",
    )?.code,
    "photo_heic",
  );
});

function storageFixture(failOn?: string): { storage: SeasonalPolaroidStorage; uploads: string[]; removed: string[][] } {
  const uploads: string[] = [];
  const removed: string[][] = [];
  const bucket = {
    upload: async (path: string) => {
      uploads.push(path);
      return { error: path.endsWith(failOn ?? "\u0000") ? { message: "failed" } : null };
    },
    remove: async (paths: string[]) => {
      removed.push(paths);
      return { error: null };
    },
  };
  return {
    storage: { storage: { from: () => bucket } },
    uploads,
    removed,
  };
}

test("uploads primary then optional secondary under private, retry-safe paths", async () => {
  const fixture = storageFixture();
  const result = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_A,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
    secondary: { bytes: PNG.buffer, contentType: "image/png" },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.uploads, [
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/secondary.input`,
  ]);
  assert.equal(
    seasonalPolaroidInputPaths(JOB_ID, ATTEMPT_A).secondary,
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/secondary.input`,
  );
});

test("one-photo uploads do not attach an unused secondary reference", async () => {
  const fixture = storageFixture();
  const result = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_A,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
  });
  assert.deepEqual(result, {
    ok: true,
    paths: {
      attemptId: ATTEMPT_A,
      primary: `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
      secondary: null,
    },
  });
  assert.deepEqual(fixture.uploads, [
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
  ]);
});

test("cleans a primary upload when the secondary upload fails", async () => {
  const fixture = storageFixture("secondary.input");
  const result = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_A,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
    secondary: { bytes: PNG.buffer, contentType: "image/png" },
  });
  assert.deepEqual(result, { ok: false, code: "storage_upload_failed" });
  assert.deepEqual(fixture.removed, [[
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/secondary.input`,
  ]]);
});

test("cleans only the allocated path when the primary upload fails", async () => {
  const fixture = storageFixture("primary.input");
  const result = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_A,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
  });
  assert.deepEqual(result, { ok: false, code: "storage_upload_failed" });
  assert.deepEqual(fixture.removed, [[
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
  ]]);
});

test("cleanup is private-object-only and reports removal failures", async () => {
  const fixture = storageFixture();
  const paths = seasonalPolaroidInputPaths(JOB_ID, ATTEMPT_A);
  assert.equal(await cleanupSeasonalPolaroidInputs(fixture.storage, paths), true);
  assert.deepEqual(fixture.removed[0], [paths.primary, paths.secondary]);
  assert.throws(() => seasonalPolaroidInputPaths("not-a-job-id", ATTEMPT_A));
});

test("concurrent attempts have isolated object ownership and cleanup", async () => {
  const fixture = storageFixture("secondary.input");
  const successful = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_B,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
  });
  const failed = await uploadSeasonalPolaroidInputs({
    storage: fixture.storage,
    jobId: JOB_ID,
    attemptId: ATTEMPT_A,
    primary: { bytes: JPEG.buffer, contentType: "image/jpeg" },
    secondary: { bytes: PNG.buffer, contentType: "image/png" },
  });
  assert.equal(successful.ok, true);
  assert.equal(failed.ok, false);
  assert.deepEqual(fixture.removed.at(-1), [
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/primary.input`,
    `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_A}/secondary.input`,
  ]);
  assert.equal(
    fixture.removed.flat().includes(`seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_B}/primary.input`),
    false,
  );
});

test("the public route stays explicitly disabled before migration/generator readiness", () => {
  const route = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
  assert.match(route, /SEASONAL_POLAROID_GENERATION_ENABLED = isSeasonalPolaroidEnabled\(\)/);
  assert.match(route, /seasonal_polaroid_unavailable/);
  assert.doesNotMatch(route, /visualMemoryGenerationCookie/);
  assert.doesNotMatch(route, /acquireAiGeneration\(/);
});
