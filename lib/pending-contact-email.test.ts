import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { maskEmail, resolvePendingContactEmail } from "./pending-contact-email.ts";

test("pending contact email is masked without hiding the domain", () => {
  assert.equal(maskEmail("hello@gmail.com"), "h***@gmail.com");
  assert.equal(maskEmail("abc.def@example.com"), "a***@example.com");
  assert.equal(maskEmail("not-an-email"), "");
});

test("the letter record email wins over the address still typed in the questionnaire", () => {
  assert.equal(resolvePendingContactEmail("abc@gmail.com", "other@gmail.com"), "abc@gmail.com");
  assert.equal(resolvePendingContactEmail(null, "ABC@Gmail.com"), "abc@gmail.com");
  assert.equal(resolvePendingContactEmail("", ""), "");
});

test("the contact lookup refuses an unsigned letter id before reading an email", () => {
  const route = readFileSync("app/api/account-result/letter/contact/route.ts", "utf8");
  const proof = route.indexOf("resultSaveProofMatches(\"letter\"");
  const read = route.indexOf("soul_trace_profiles");
  assert.ok(proof >= 0 && proof < read);
  assert.doesNotMatch(route, /claim_soul_trace_legacy_records/);
});
