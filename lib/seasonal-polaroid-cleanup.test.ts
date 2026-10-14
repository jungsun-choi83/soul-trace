import assert from "node:assert/strict";
import test from "node:test";

import {
  executeSeasonalPolaroidCleanup,
  planSeasonalPolaroidOrphanCleanup,
  planSeasonalPolaroidCleanup,
  SEASONAL_POLAROID_INPUT_RETENTION_MS,
} from "./seasonal-polaroid-cleanup.ts";

const JOB_ID = "a".repeat(64);
const ATTEMPT_ID = "b".repeat(32);
const UPDATED_AT = Date.parse("2026-01-01T00:00:00.000Z");

function state(overrides: Partial<Parameters<typeof planSeasonalPolaroidCleanup>[0]> = {}) {
  return {
    jobId: JOB_ID,
    status: "succeeded" as const,
    updatedAt: new Date(UPDATED_AT).toISOString(),
    inputPaths: {
      attemptId: ATTEMPT_ID,
      primary: "seasonal-polaroid/" + JOB_ID + "/inputs/" + ATTEMPT_ID + "/primary.input",
      secondary: "seasonal-polaroid/" + JOB_ID + "/inputs/" + ATTEMPT_ID + "/secondary.input",
    },
    resultPath: "seasonal-polaroid/" + JOB_ID + "/result/" + ATTEMPT_ID + ".jpg",
    resultSaved: false,
    ...overrides,
  };
}

test("cleanup never removes inputs for queued or processing jobs", () => {
  for (const status of ["queued", "processing"] as const) {
    const plan = planSeasonalPolaroidCleanup(state({ status }), UPDATED_AT + 90 * 24 * 60 * 60 * 1000);
    assert.equal(plan.reason, "active");
    assert.deepEqual(plan.removeInputPaths, []);
    assert.equal(plan.removeResultPath, null);
  }
});

test("cleanup removes only job-owned inputs after the grace period", () => {
  const plan = planSeasonalPolaroidCleanup(
    state({ resultSaved: true }),
    UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  );
  assert.equal(plan.reason, "eligible");
  assert.equal(plan.removeInputPaths.length, 2);
  assert.equal(plan.removeResultPath, null);
});

test("all successfully generated results remain protected", () => {
  const plan = planSeasonalPolaroidCleanup(
    state(),
    UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  );
  assert.equal(plan.reason, "eligible");
  assert.equal(plan.removeResultPath, null);

  const farFuture = planSeasonalPolaroidCleanup(
    state({ resultSaved: true }),
    UPDATED_AT + 365 * 24 * 60 * 60 * 1000,
  );
  assert.equal(farFuture.removeResultPath, null);
});

test("cleanup rejects references that do not belong to the job", () => {
  const plan = planSeasonalPolaroidCleanup(
    state({
      inputPaths: {
        attemptId: ATTEMPT_ID,
        primary: "seasonal-polaroid/" + "c".repeat(64) + "/inputs/" + ATTEMPT_ID + "/primary.input",
        secondary: null,
      },
    }),
    UPDATED_AT + 365 * 24 * 60 * 60 * 1000,
  );
  assert.equal(plan.reason, "invalid_reference");
  assert.deepEqual(plan.removeInputPaths, []);
  assert.equal(plan.removeResultPath, null);
});

test("failed terminal jobs can release their temporary inputs after the grace period", () => {
  const plan = planSeasonalPolaroidCleanup(
    state({ status: "failed", resultPath: null }),
    UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  );
  assert.equal(plan.reason, "eligible");
  assert.equal(plan.removeInputPaths.length, 2);
  assert.equal(plan.removeResultPath, null);
});

test("cleanup execution removes only validated terminal input resources", async () => {
  const removed: string[][] = [];
  const storage = {
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  const execution = await executeSeasonalPolaroidCleanup({
    storage,
    state: state({ resultSaved: false }),
    now: UPDATED_AT + 365 * 24 * 60 * 60 * 1000,
  });
  assert.equal(execution.removalFailed, false);
  assert.equal(execution.removedPaths.length, 2);
  assert.deepEqual(removed, [execution.removedPaths]);
});

test("cleanup execution is a no-op for active jobs and protects saved results", async () => {
  const removed: string[][] = [];
  const storage = {
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  const active = await executeSeasonalPolaroidCleanup({
    storage,
    state: state({ status: "processing" }),
    now: UPDATED_AT + 365 * 24 * 60 * 60 * 1000,
  });
  const saved = await executeSeasonalPolaroidCleanup({
    storage,
    state: state({ resultSaved: true }),
    now: UPDATED_AT + 365 * 24 * 60 * 60 * 1000,
  });
  assert.equal(active.plan.reason, "active");
  assert.equal(saved.plan.reason, "eligible");
  assert.equal(saved.plan.removeResultPath, null);
  assert.equal(removed.length, 1);
  assert.equal(removed[0]?.length, 2);
});

test("cleanup can be retried safely when private storage removal fails", async () => {
  const storage = {
    storage: {
      from: () => ({
        remove: async () => ({ error: { message: "temporary failure" } }),
      }),
    },
  };
  const execution = await executeSeasonalPolaroidCleanup({
    storage,
    state: state(),
    now: UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  });
  assert.equal(execution.removalFailed, true);
  assert.deepEqual(execution.removedPaths, []);
  assert.equal(execution.plan.reason, "eligible");
});

test("orphan planning fails closed when the authoritative reference set is incomplete", () => {
  const path = `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_ID}/primary.input`;
  assert.deepEqual(planSeasonalPolaroidOrphanCleanup({
    objects: [{ path, createdAt: new Date(UPDATED_AT).toISOString() }],
    referencedPaths: new Set(),
    referencesComplete: false,
    now: UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  }), []);
});

test("orphan planning requires an old, exact Seasonal input path and no job reference", () => {
  const valid = `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_ID}/primary.input`;
  const referenced = `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_ID}/secondary.input`;
  const now = UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1;
  const candidates = planSeasonalPolaroidOrphanCleanup({
    objects: [
      { path: valid, createdAt: new Date(UPDATED_AT).toISOString() },
      { path: referenced, createdAt: new Date(UPDATED_AT).toISOString() },
      { path: `seasonal-polaroid/${JOB_ID}/result/${ATTEMPT_ID}.jpg`, createdAt: new Date(UPDATED_AT).toISOString() },
      { path: "other-prefix/orphan.input", createdAt: new Date(UPDATED_AT).toISOString() },
      { path: valid, createdAt: new Date(now - 1).toISOString() },
      { path: valid, createdAt: "not-a-date" },
    ],
    referencedPaths: new Set([referenced]),
    referencesComplete: true,
    now,
  });
  assert.deepEqual(candidates, [valid]);
});
