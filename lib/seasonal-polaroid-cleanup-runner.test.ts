import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { runSeasonalPolaroidCleanup, type SeasonalCleanupPayload } from "./seasonal-polaroid-cleanup-runner.ts";

const JOB_ID = "a".repeat(64);
const ATTEMPT_ID = "b".repeat(32);
const UPDATED_AT = Date.parse("2026-01-01T00:00:00.000Z");
const INPUT = {
  attemptId: ATTEMPT_ID,
  primary: `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT_ID}/primary.input`,
  secondary: null,
};
const PAYLOAD: SeasonalCleanupPayload = {
  inputPhotos: INPUT,
  resultPath: `seasonal-polaroid/${JOB_ID}/result/${ATTEMPT_ID}.jpg`,
};
const routeSource = readFileSync("app/api/internal/seasonal-polaroid-cleanup/route.ts", "utf8");

function parser(value: unknown, jobId: string): SeasonalCleanupPayload | null {
  return jobId === JOB_ID && value === PAYLOAD ? PAYLOAD : null;
}

function queryChain(data: unknown, error: null | { message: string } = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    lte: () => chain,
    order: () => chain,
    limit: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
  };
  return chain;
}

test("cleanup endpoint is cron-authenticated and fail-closed for deletion", () => {
  assert.match(routeSource, /authorization === `Bearer \$\{secret\}`/);
  assert.match(routeSource, /SOUL_TRACE_SEASONAL_CLEANUP_DELETE_ENABLED === "true"/);
  assert.match(routeSource, /return body\.dryRun !== false/);
  assert.match(routeSource, /status: 404/);
});

test("cleanup runner is dry-run by default and never deletes results", async () => {
  const old = {
    idempotency_key: JOB_ID,
    status: "succeeded" as const,
    updated_at: new Date(UPDATED_AT).toISOString(),
    input_payload: PAYLOAD,
  };
  let removed = false;
  const db = {
    from: (table: string) => {
      if (table === "ai_generation_jobs") return queryChain([old]);
      return { remove: async () => ({ error: null }) };
    },
    storage: { from: () => ({ remove: async () => { removed = true; return { error: null }; } }) },
  };
  const report = await runSeasonalPolaroidCleanup({
    db: db as never,
    parsePayload: parser,
    now: UPDATED_AT + 25 * 60 * 60 * 1000,
  });
  assert.equal(report.dryRun, true);
  assert.equal(report.eligible, 1);
  assert.equal(report.removed, 0);
  assert.equal(removed, false);
});

test("cleanup runner rechecks terminal ownership before an enabled deletion", async () => {
  const old = {
    idempotency_key: JOB_ID,
    status: "failed" as const,
    updated_at: new Date(UPDATED_AT).toISOString(),
    input_payload: PAYLOAD,
  };
  let queryCount = 0;
  let removedPaths: string[] = [];
  const db = {
    from: () => {
      queryCount += 1;
      return queryChain(queryCount === 1 ? [old] : old);
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => { removedPaths = paths; return { error: null }; },
      }),
    },
  };
  const report = await runSeasonalPolaroidCleanup({
    db: db as never,
    parsePayload: parser,
    dryRun: false,
    deletionEnabled: true,
    now: UPDATED_AT + 25 * 60 * 60 * 1000,
  });
  assert.equal(report.removed, 1);
  assert.deepEqual(removedPaths, [INPUT.primary]);
  assert.equal(queryCount, 2);
});

test("cleanup runner skips a job that changes between scan and delete", async () => {
  const old = {
    idempotency_key: JOB_ID,
    status: "succeeded" as const,
    updated_at: new Date(UPDATED_AT).toISOString(),
    input_payload: PAYLOAD,
  };
  const changed = { ...old, status: "failed" as const, updated_at: new Date(UPDATED_AT + 1).toISOString() };
  let queryCount = 0;
  let removed = false;
  const db = {
    from: (table: string) => {
      if (table === "ai_generation_jobs") {
        queryCount += 1;
        return queryChain(queryCount === 1 ? [old] : changed);
      }
      return queryChain([]);
    },
    storage: { from: () => ({ remove: async () => { removed = true; return { error: null }; } }) },
  };
  const report = await runSeasonalPolaroidCleanup({
    db: db as never,
    parsePayload: parser,
    dryRun: false,
    deletionEnabled: true,
    now: UPDATED_AT + 25 * 60 * 60 * 1000,
  });
  assert.equal(report.removed, 0);
  assert.equal(report.reasons.changed_before_delete, 1);
  assert.equal(removed, false);
});
