import assert from "node:assert/strict";
import test from "node:test";

import {
  planSeasonalPolaroidCleanup,
  SEASONAL_POLAROID_INPUT_RETENTION_MS,
  SEASONAL_POLAROID_RESULT_RETENTION_MS,
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

test("unsaved generated results have a longer retention window", () => {
  const plan = planSeasonalPolaroidCleanup(
    state(),
    UPDATED_AT + SEASONAL_POLAROID_INPUT_RETENTION_MS + 1,
  );
  assert.equal(plan.reason, "eligible");
  assert.equal(plan.removeResultPath, null);

  const expired = planSeasonalPolaroidCleanup(
    state(),
    UPDATED_AT + SEASONAL_POLAROID_RESULT_RETENTION_MS + 1,
  );
  assert.equal(expired.removeResultPath, "seasonal-polaroid/" + JOB_ID + "/result/" + ATTEMPT_ID + ".jpg");
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
    UPDATED_AT + SEASONAL_POLAROID_RESULT_RETENTION_MS + 1,
  );
  assert.equal(plan.reason, "invalid_reference");
  assert.deepEqual(plan.removeInputPaths, []);
  assert.equal(plan.removeResultPath, null);
});
