import assert from "node:assert/strict";
import test from "node:test";

import {
  issueSeasonalPolaroidCapability,
  issueSeasonalPolaroidImageAccessToken,
  seasonalPolaroidImageAccessTokenMatches,
  seasonalPolaroidCapabilityMatches,
} from "./seasonal-polaroid-capability.ts";

const JOB_ID = "a".repeat(64);
const REQUEST_HASH = "b".repeat(64);

test("Seasonal capability is job/request scoped and reload-stable", () => {
  const previous = process.env.AI_GENERATION_GUARD_SECRET;
  process.env.AI_GENERATION_GUARD_SECRET = "test-secret";
  try {
    const token = issueSeasonalPolaroidCapability(JOB_ID, REQUEST_HASH);
    assert.ok(token);
    assert.equal(seasonalPolaroidCapabilityMatches(token, JOB_ID, REQUEST_HASH), true);
    assert.equal(seasonalPolaroidCapabilityMatches(token, JOB_ID, "c".repeat(64)), false);
    assert.equal(seasonalPolaroidCapabilityMatches(token, "d".repeat(64), REQUEST_HASH), false);
    assert.equal(seasonalPolaroidCapabilityMatches(`${token}x`, JOB_ID, REQUEST_HASH), false);
  } finally {
    if (previous === undefined) delete process.env.AI_GENERATION_GUARD_SECRET;
    else process.env.AI_GENERATION_GUARD_SECRET = previous;
  }
});

test("capability issuance stays unavailable without the guard secret", () => {
  const previous = process.env.AI_GENERATION_GUARD_SECRET;
  const previousService = process.env.SOUL_TRACE_SERVICE_TOKEN;
  delete process.env.AI_GENERATION_GUARD_SECRET;
  delete process.env.SOUL_TRACE_SERVICE_TOKEN;
  try {
    assert.equal(issueSeasonalPolaroidCapability(JOB_ID, REQUEST_HASH), null);
  } finally {
    if (previous === undefined) delete process.env.AI_GENERATION_GUARD_SECRET;
    else process.env.AI_GENERATION_GUARD_SECRET = previous;
    if (previousService === undefined) delete process.env.SOUL_TRACE_SERVICE_TOKEN;
    else process.env.SOUL_TRACE_SERVICE_TOKEN = previousService;
  }
});

test("image delivery tokens expire independently from the reload-safe job capability", () => {
  const previous = process.env.AI_GENERATION_GUARD_SECRET;
  process.env.AI_GENERATION_GUARD_SECRET = "test-secret";
  const now = 1_700_000_000_000;
  try {
    const token = issueSeasonalPolaroidImageAccessToken(JOB_ID, REQUEST_HASH, now);
    assert.ok(token);
    assert.equal(seasonalPolaroidImageAccessTokenMatches(token, JOB_ID, REQUEST_HASH, now), true);
    assert.equal(seasonalPolaroidImageAccessTokenMatches(token, JOB_ID, REQUEST_HASH, now + 301_000), false);
    assert.equal(seasonalPolaroidImageAccessTokenMatches(token, JOB_ID, "c".repeat(64), now), false);
  } finally {
    if (previous === undefined) delete process.env.AI_GENERATION_GUARD_SECRET;
    else process.env.AI_GENERATION_GUARD_SECRET = previous;
  }
});
