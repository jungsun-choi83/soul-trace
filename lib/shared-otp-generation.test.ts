import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const letterFlow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const otpGate = readFileSync("components/letter-download-gate.tsx", "utf8");
const letterRoute = readFileSync("app/api/generate-letter/route.ts", "utf8");
const polaroidFlow = readFileSync("components/polaroid-entry.tsx", "utf8");
const otp = readFileSync("lib/letter-download-auth.ts", "utf8");

test("Letter generation requires a server-authenticated account before admission", () => {
  assert.match(letterRoute, /createSupabaseAuthServerClient/);
  assert.match(letterRoute, /authentication_required/);
  assert.match(letterRoute, /authenticatedUser\.id/);
  assert.match(letterRoute, /body\.authenticatedUserId = authenticatedUser\.id/);
  assert.match(letterRoute, /workerAuthorized/);
});

test("returning authenticated users reuse the verified account email", () => {
  assert.match(letterFlow, /authSession\.status === "authenticated" \|\| isValidQuestionnaireEmail/);
  assert.match(letterFlow, /authSession\.email \?\? email/);
  assert.match(letterFlow, /purpose="letter-generation"[\s\S]*?pendingEmail=\{email\}/);
  assert.match(readFileSync("components/use-auth-session.ts", "utf8"), /Promise\.race/);
});

test("first-time Letter users use the shared OTP gate and resume generation after verification", () => {
  assert.match(letterFlow, /purpose="letter-generation"/);
  assert.match(letterFlow, /setGenerationGateOpen\(true\)/);
  assert.match(letterFlow, /authSession\.status === "loading"[\s\S]*await authSession\.refresh\(\)/);
  assert.match(letterFlow, /errors\.questionnaireIncomplete/);
  assert.match(letterFlow, /sessionStorage\.removeItem\(pendingGenerationStorageKey\)/);
  assert.match(otpGate, /verifyLetterDownloadCode/);
  assert.match(letterFlow, /void submitAnswers\(true\)/);

  // The generation gate must be rendered in the questionnaire branch. If it
  // only lives in the completed-result branch, opening it changes state but
  // cannot display a modal while result is still null.
  const questionnaireMarker = letterFlow.indexOf("data-questionnaire-pet-theme");
  const generationGate = letterFlow.indexOf('purpose="letter-generation"');
  assert.ok(questionnaireMarker >= 0, "questionnaire branch should be present");
  assert.ok(generationGate > questionnaireMarker, "generation OTP gate must be mounted with questionnaire");
});

test("Seasonal Polaroid uses the same OTP request and verification helpers", () => {
  assert.match(polaroidFlow, /requestLetterDownloadCode/);
  assert.match(polaroidFlow, /verifyLetterDownloadCode/);
  assert.match(polaroidFlow, /authSession\.refresh/);
});

test("Reveal the Letter reports invalid input instead of silently returning", () => {
  assert.match(letterFlow, /onClick=\{\(\) => void submitAnswers\(\)\}/);
  assert.match(letterFlow, /setError\(isEmailQuestion \? t\("form\.emailStep\.validation"\) : t\("errors\.questionnaireIncomplete"\)\)/);
});

test("OTP verification remains strict for invalid and expired codes", () => {
  assert.match(otp, /type: "email"/);
  assert.match(otp, /"invalid_code"/);
  assert.match(otp, /"expired"/);
  assert.match(otp, /data\?\.session/);
});
