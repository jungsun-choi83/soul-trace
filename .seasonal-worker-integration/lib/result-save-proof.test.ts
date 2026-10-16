import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createResultSaveProof, resultSaveProofMatches } from "./result-save-proof.ts";
import { letterAttachmentDecision } from "./attach-current-letter.ts";
import { visualMemoryGenerationUsed } from "./visual-memory-generation-allowance.ts";

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

test("another visual memory is refused before the image API", () => {
  const route = readFileSync("app/api/visual-memory/route.ts", "utf8");
  const allowance = route.indexOf("if (visualMemoryGenerationUsed");
  const imageApi = route.indexOf("openai.images.edit");
  assert.ok(allowance >= 0 && allowance < imageApi);
  assert.match(route, /additional_generation_unavailable/);
  assert.match(readFileSync("app/api/account-result/visual-memory/route.ts", "utf8"), /result_forbidden/);
  assert.doesNotMatch(readFileSync("app/api/account-result/letter/route.ts", "utf8"), /claim_soul_trace_legacy_records/);
});

test("a visual memory allowance cookie survives later page visits", () => {
  assert.equal(visualMemoryGenerationUsed(null), false);
  assert.equal(visualMemoryGenerationUsed("soul-trace-vm-generation=1"), true);
  assert.equal(visualMemoryGenerationUsed("other=1; soul-trace-vm-generation=1"), true);
});
