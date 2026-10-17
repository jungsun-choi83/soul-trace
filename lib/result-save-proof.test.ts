import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createResultSaveProof, resultSaveProofMatches } from "./result-save-proof.ts";
import { letterAttachmentDecision } from "./attach-current-letter.ts";

const LETTER_ID = "11111111-1111-4111-8111-111111111111";

test("a result proof only matches the result and kind it was signed for", () => {
  const proof = createResultSaveProof("letter", LETTER_ID, "secret");
  assert.equal(resultSaveProofMatches("letter", LETTER_ID, proof ?? "", "secret"), true);
  assert.equal(resultSaveProofMatches("visual-memory", LETTER_ID, proof ?? "", "secret"), false);
  assert.equal(resultSaveProofMatches("letter", LETTER_ID, proof ?? "", "other"), false);
  assert.equal(createResultSaveProof("letter", "not-a-uuid", "secret"), null);
});

test("only an unowned letter can be attached to the current account", () => {
  assert.equal(letterAttachmentDecision(null, "user-1"), "claim");
  assert.equal(letterAttachmentDecision("user-1", "user-1"), "already_saved");
  assert.equal(letterAttachmentDecision("user-2", "user-1"), "forbidden");
});

test("new Visual Memory admissions are disabled while historical access remains protected", () => {
  const route = readFileSync("app/api/visual-memory/route.ts", "utf8");
  assert.match(route, /visual_memory_unavailable/);
  assert.match(route, /hasWorkerCredentials/);
  assert.match(route, /generation_kind === "visual_memory"/);
  assert.match(readFileSync("app/api/account-result/visual-memory/route.ts", "utf8"), /result_forbidden/);
  assert.doesNotMatch(readFileSync("app/api/account-result/letter/route.ts", "utf8"), /claim_soul_trace_legacy_records/);
});
