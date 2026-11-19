import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("app/api/auth/local-preview/route.ts", "utf8");
const authEntry = readFileSync("components/auth-entry.tsx", "utf8");

test("local preview signs in onto the JSON response cookies", () => {
  assert.match(route, /response\.cookies\.set/);
  assert.match(route, /createServerClient/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /return response/);
  assert.doesNotMatch(route, /createSupabaseAuthServerClient/);
});

test("local preview tries existing password before resetting the preview user", () => {
  const firstSignIn = route.indexOf("signInWithPassword");
  const updatePassword = route.indexOf("updateUserById");
  assert.ok(firstSignIn >= 0);
  assert.ok(updatePassword > firstSignIn);
});

test("auth entry still uses the local preview route before continuing", () => {
  assert.match(authEntry, /fetch\("\/api\/auth\/local-preview"/);
  assert.match(authEntry, /continueAfterAuth/);
  assert.match(authEntry, /테스트로 들어가기/);
});

test("empty test entry stays on the preview account and soultrace.pet", () => {
  assert.match(route, /soultrace\.pet/);
  assert.match(route, /local-preview@soultrace\.test/);
  assert.match(route, /previewHostAllowed/);
  assert.doesNotMatch(route, /request\.json\(/);
});
