import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FreeTrialLedger, FREE_GRANT_DAILY_CAP, GUEST_RETENTION_MS, GUEST_STARTS_PER_HOUR } from "./pet-free-trial.ts";

const day = 1_700_000_000_000;
let seq = 0;
const ledger = () => new FreeTrialLedger(() => `id-${++seq}`);

function guest(session = "guest-1") {
  return { userId: null, guestSessionId: session };
}

test("a new pet receives one free polaroid and an existing pet does not get another", () => {
  seq = 0;
  const book = ledger();
  const created = book.registerPet({ actor: guest(), name: "콩이", now: day, ipKey: "ip" });
  assert.equal(created.ok && created.remaining, 1);
  const petId = created.ok ? created.petId : "";
  const again = book.registerPet({ actor: guest(), name: "콩이", now: day, ipKey: "ip", petId });
  assert.equal(again.ok && again.petId, petId);
  assert.equal(book.remaining(petId), 1);
});

test("renaming or replacing the photo does not restore a used free polaroid", () => {
  seq = 0;
  const book = ledger();
  const created = book.registerPet({ actor: guest(), name: "콩이", now: day, ipKey: "ip" });
  const petId = created.ok ? created.petId : "";
  const reserved = book.reserve({ petId, actor: guest(), style: "felt-doll", idempotencyKey: "idem-0001" });
  assert.equal(reserved.ok, true);
  if (reserved.ok) assert.equal(book.succeed(reserved.reservation.jobId), null);
  assert.equal(book.rename(petId, guest(), "콩순이"), null);
  assert.equal(book.replacePhoto(petId, guest()), null);
  assert.equal(book.remaining(petId), 0);
  const second = book.reserve({ petId, actor: guest(), style: "gouache-story", idempotencyKey: "idem-0002" });
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error, "exhausted");
});

test("the same request key does not spend a second credit, and a failed job gives it back", () => {
  seq = 0;
  const book = ledger();
  const created = book.registerPet({ actor: guest(), name: "콩이", now: day, ipKey: "ip" });
  const petId = created.ok ? created.petId : "";
  const actor = guest();
  const first = book.reserve({ petId, actor, style: "crayon-diary", idempotencyKey: "idem-same" });
  const replay = book.reserve({ petId, actor, style: "felt-doll", idempotencyKey: "idem-same" });
  assert.equal(first.ok && replay.ok && first.reservation.jobId, replay.reservation.jobId);
  assert.equal(replay.ok && replay.reservation.replayed, true);
  if (first.ok) assert.equal(book.fail(first.reservation.jobId), null);
  assert.equal(book.remaining(petId), 1);
  const retry = book.reserve({ petId, actor, style: "gouache-story", idempotencyKey: "idem-same" });
  assert.equal(retry.ok, true);
});

test("claiming a guest pet keeps the used credit on the same pet", () => {
  seq = 0;
  const book = ledger();
  const created = book.registerPet({ actor: guest(), name: "콩이", now: day, ipKey: "ip" });
  const petId = created.ok ? created.petId : "";
  const reserved = book.reserve({ petId, actor: guest(), style: "felt-doll", idempotencyKey: "idem-claim" });
  if (reserved.ok) book.succeed(reserved.reservation.jobId);
  assert.deepEqual(book.claim("guest-1", "user-1"), [petId]);
  assert.equal(book.remaining(petId), 0);
  const outsider = book.reserve({ petId, actor: { userId: "user-2", guestSessionId: null }, style: "felt-doll", idempotencyKey: "idem-other" });
  assert.equal(outsider.ok, false);
  if (!outsider.ok) assert.equal(outsider.error, "forbidden");
});

test("delete and restore keep the same credit, and another account cannot use the pet", () => {
  seq = 0;
  const book = ledger();
  const user = { userId: "user-1", guestSessionId: null };
  const created = book.registerPet({ actor: user, name: "콩이", now: day, ipKey: "ip" });
  const petId = created.ok ? created.petId : "";
  const reserved = book.reserve({ petId, actor: user, style: "felt-doll", idempotencyKey: "idem-del1" });
  if (reserved.ok) book.succeed(reserved.reservation.jobId);
  assert.equal(book.deletePet(petId, user, day), null);
  const whileDeleted = book.reserve({ petId, actor: user, style: "felt-doll", idempotencyKey: "idem-del2" });
  assert.equal(whileDeleted.ok, false);
  if (!whileDeleted.ok) assert.equal(whileDeleted.error, "deleted");
  assert.equal(book.restorePet(petId, user), null);
  assert.equal(book.remaining(petId), 0);
  assert.equal(book.deletePet(petId, { userId: "user-2", guestSessionId: null }, day), "forbidden");
});

test("a reinstall session cannot reset another guest pet, and old guest data expires", () => {
  seq = 0;
  const book = ledger();
  const created = book.registerPet({ actor: guest("phone-a"), name: "콩이", now: day, ipKey: "ip" });
  const petId = created.ok ? created.petId : "";
  const fresh = book.reserve({ petId, actor: guest("phone-b"), style: "felt-doll", idempotencyKey: "idem-reinstall" });
  assert.equal(fresh.ok, false);
  if (!fresh.ok) assert.equal(fresh.error, "forbidden");
  book.purge(day + GUEST_RETENTION_MS + 1);
  assert.equal(book.pet(petId), null);
  assert.equal(book.remaining(petId), 0);
});

test("repeated new pets are capped per day and guest sessions keep a single pet", () => {
  seq = 0;
  const book = ledger();
  const user = { userId: "user-1", guestSessionId: null };
  for (let index = 0; index < FREE_GRANT_DAILY_CAP; index += 1) {
    const created = book.registerPet({ actor: user, name: `아이${index}`, now: day + index, ipKey: `ip-${index}` });
    assert.equal(created.ok && created.remaining, 1);
  }
  const blocked = book.registerPet({ actor: user, name: "한마리더", now: day + 10, ipKey: "ip-x" });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error, "withheld");
  const first = book.registerPet({ actor: guest(), name: "게스트", now: day, ipKey: "guest-ip" });
  assert.equal(first.ok, true);
  const second = book.registerPet({ actor: guest(), name: "둘째", now: day + 1, ipKey: "guest-ip-2" });
  assert.equal(second.ok && first.ok && second.petId, first.ok ? first.petId : "");
  assert.equal(book.remaining(first.ok ? first.petId : ""), 1);
});

test("anonymous starts are rate limited", () => {
  seq = 0;
  const book = ledger();
  for (let index = 0; index < GUEST_STARTS_PER_HOUR; index += 1) {
    const created = book.registerPet({ actor: guest(`s${index}`), name: "아이", now: day, ipKey: "shared" });
    assert.equal(created.ok, true);
  }
  const limited = book.registerPet({ actor: guest("overflow"), name: "아이", now: day, ipKey: "shared" });
  assert.equal(limited.ok, false);
  if (!limited.ok) assert.equal(limited.error, "rate_limited");
});

test("the migration keeps one polaroid grant per pet and can be rolled back without dropping pets", () => {
  const sql = readFileSync("supabase/migration_pet_free_entitlements.sql", "utf8");
  const rollback = readFileSync("supabase/rollback_pet_free_entitlements.sql", "utf8");
  assert.match(sql, /unique \(pet_id, grant_kind\)/);
  assert.match(sql, /idempotency_key text not null unique/);
  assert.match(sql, /reserve_pet_free_polaroid/);
  assert.match(sql, /status = 'available'/);
  assert.match(sql, /owner_user_id = p_owner_user_id/);
  assert.doesNotMatch(sql, /drop table/);
  assert.match(rollback, /drop table if exists public\.pet_free_entitlements/);
  assert.doesNotMatch(rollback, /drop table[^;]*soul_trace_pets/);
});
