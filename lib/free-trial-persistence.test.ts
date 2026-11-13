import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canReadFreeTrialResult,
  decideFreeTrialClaim,
  failedFreeTrialAllowance,
  freeTrialResultObjectKey,
  freeTrialRetryOutcome,
} from "./free-trial-persistence-contract.ts";

const migration = readFileSync("supabase/drafts/20261109_004_free_trial_durable.sql", "utf8");
const server = readFileSync("lib/free-trial-persistence-server.ts", "utf8");

test("result access is limited to its owner or the matching guest session", () => {
  const result = { ownerUserId: null, guestSessionHash: "guest-hash" };
  assert.equal(canReadFreeTrialResult(result, { userId: null, guestHash: "guest-hash" }), true);
  assert.equal(canReadFreeTrialResult(result, { userId: null, guestHash: "other" }), false);
  assert.equal(canReadFreeTrialResult(result, { userId: "user-1", guestHash: null }), false);
  assert.equal(canReadFreeTrialResult({ ownerUserId: "user-1", guestSessionHash: null }, { userId: "user-1", guestHash: null }), true);
  assert.equal(canReadFreeTrialResult({ ownerUserId: "user-1", guestSessionHash: null }, { userId: "user-2", guestHash: null }), false);
});

test("claim retries are idempotent, owner-bound, and expire", () => {
  assert.equal(decideFreeTrialClaim({ claim: null, hasGuestRecords: true, userId: "user-1", now: 10 }), "claim");
  assert.equal(decideFreeTrialClaim({ claim: null, hasGuestRecords: false, userId: "user-1", now: 10 }), "missing");
  assert.equal(decideFreeTrialClaim({ claim: { ownerUserId: "user-1", expiresAt: 20 }, hasGuestRecords: false, userId: "user-1", now: 10 }), "already_claimed");
  assert.equal(decideFreeTrialClaim({ claim: { ownerUserId: "user-1", expiresAt: 20 }, hasGuestRecords: false, userId: "user-2", now: 10 }), "owned_by_other");
  assert.equal(decideFreeTrialClaim({ claim: { ownerUserId: "user-1", expiresAt: 10 }, hasGuestRecords: true, userId: "user-1", now: 10 }), "expired");
  assert.match(migration, /expires_at timestamptz not null default\(now\(\)\+interval '30 days'\)/);
});

test("generation retries reuse the stable result and reject changed requests", () => {
  assert.equal(freeTrialRetryOutcome({ status: "failed", samePet: true, sameRequest: true }), "retry");
  assert.equal(freeTrialRetryOutcome({ status: "reserved", samePet: true, sameRequest: true }), "in_progress");
  assert.equal(freeTrialRetryOutcome({ status: "succeeded", samePet: true, sameRequest: true }), "replay");
  assert.equal(freeTrialRetryOutcome({ status: "failed", samePet: false, sameRequest: true }), "conflict");
  assert.equal(freeTrialRetryOutcome({ status: "failed", samePet: true, sameRequest: false }), "conflict");
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(freeTrialResultObjectKey(id), "free-trial/" + id + ".jpg");
  assert.equal(freeTrialResultObjectKey("bad"), null);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /result_id uuid primary key references public\.free_trial_generations/);
});

test("failed generation releases a reserved allowance for retry", () => {
  assert.equal(failedFreeTrialAllowance("reserved"), "available");
  assert.equal(failedFreeTrialAllowance("consumed"), "consumed");
  assert.match(migration, /set status='available',generation_id=null/);
  assert.match(migration, /g\.updated_at>now\(\)-interval '5 minutes'/);
});

test("result images use a private bucket and authenticated retrieval checks ownership", () => {
  assert.match(migration, /values\('free-trial-results','free-trial-results',false\)/);
  assert.match(migration, /authorize_free_trial_result/);
  assert.match(server, /authorize_free_trial_result/);
  assert.match(server, /storage\.from\(BUCKET\)\.download/);
  assert.doesNotMatch(migration, /insert into public\.(life_archive_memories|pet_timeline_entries)/i);
});

test("durable path stays disabled until both explicit schema and feature flags are set", () => {
  assert.match(server, /SOUL_TRACE_FREE_TRIAL_PERSISTENCE_ENABLED === "true"/);
  assert.match(server, /SOUL_TRACE_FREE_TRIAL_SCHEMA_READY === "true"/);
});
