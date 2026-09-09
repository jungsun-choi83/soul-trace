import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  passwordRecoveryCallbackUrl,
  safeAuthConfirmationPath,
  safeRecoveryDestination,
} from "./auth-redirect.ts";
import {
  passwordValidationError,
  requestPasswordRecovery,
  updateRecoveryPassword,
  type PasswordUpdateClient,
  type RecoveryClient,
} from "./password-recovery.ts";

test("recovery request normalizes email and happens only when explicitly called", async () => {
  const calls: unknown[] = [];
  const client: RecoveryClient = { auth: { async resetPasswordForEmail(email, options) {
    calls.push({ email, options });
    return { error: null };
  } } };
  assert.equal(calls.length, 0);
  assert.equal(await requestPasswordRecovery(client, {
    email: "  Person@Example.COM ",
    redirectTo: "https://example.test/auth/confirm",
  }), "sent");
  assert.deepEqual(calls, [{ email: "person@example.com", options: { redirectTo: "https://example.test/auth/confirm" } }]);
});

test("invalid recovery email makes no request and failures remain generic", async () => {
  let calls = 0;
  const client: RecoveryClient = { auth: { async resetPasswordForEmail() {
    calls += 1;
    return { error: { message: "unknown account" } };
  } } };
  assert.equal(await requestPasswordRecovery(client, { email: "bad", redirectTo: "https://example.test" }), "invalid_email");
  assert.equal(calls, 0);
  assert.equal(await requestPasswordRecovery(client, { email: "person@example.com", redirectTo: "https://example.test" }), "request_failed");
});

test("recovery callback preserves safe destination and permits only update-password", () => {
  const returnTo = "/living?ch=pension&p=partner&campaign=one&campaign=two#questions";
  const callback = new URL(passwordRecoveryCallbackUrl("https://example.test", returnTo, "ko"));
  const next = callback.searchParams.get("next");
  assert.equal(next, `/auth/update-password?returnTo=${encodeURIComponent(returnTo)}`);
  assert.equal(safeAuthConfirmationPath(next, "/life-archive"), next);
  assert.equal(safeRecoveryDestination("/auth"), null);
  assert.equal(safeRecoveryDestination("/auth/confirm"), null);
  assert.equal(safeRecoveryDestination("https://evil.test/auth/update-password"), null);
});

test("recovery preserves every QR channel destination", () => {
  for (const destination of [
    "/living?ch=pension",
    "/living?ch=grooming",
    "/living?ch=hospital",
    "/memorial?ch=funeral",
  ]) {
    const callback = new URL(passwordRecoveryCallbackUrl("https://example.test", destination, "en"));
    const updatePath = callback.searchParams.get("next");
    assert.ok(updatePath);
    assert.equal(new URL(updatePath, "https://example.test").searchParams.get("returnTo"), destination);
  }
});

test("password validation requires eight matching characters", () => {
  assert.equal(passwordValidationError("short", "short"), "too_short");
  assert.equal(passwordValidationError("long-enough", "different"), "mismatch");
  assert.equal(passwordValidationError("long-enough", "long-enough"), null);
});

test("successful update sets only password then signs out locally", async () => {
  const calls: unknown[] = [];
  const client: PasswordUpdateClient = { auth: {
    async updateUser(attributes) { calls.push(attributes); return { error: null }; },
    async signOut(options) { calls.push(options); return { error: null }; },
  } };
  assert.equal(await updateRecoveryPassword(client, "safe-password"), "updated");
  assert.deepEqual(calls, [{ password: "safe-password" }, { scope: "local" }]);
});

test("stronger remote policy and other errors map to safe categories", async () => {
  for (const [error, expected] of [[{ code: "weak_password" }, "policy_failed"], [{ code: "other" }, "request_failed"]] as const) {
    const client: PasswordUpdateClient = { auth: {
      async updateUser() { return { error }; },
      async signOut() { throw new Error("must not sign out"); },
    } };
    assert.equal(await updateRecoveryPassword(client, "safe-password"), expected);
  }
});

test("update page rejects unauthenticated access and passwords never enter storage or URLs", () => {
  const page = readFileSync("app/auth/update-password/page.tsx", "utf8");
  const form = readFileSync("components/password-update-form.tsx", "utf8");
  const entry = readFileSync("components/auth-entry.tsx", "utf8");
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /if \(!user\)/);
  assert.match(form, /type="password"/);
  assert.match(form, /autoComplete="new-password"/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(form, /searchParams\.set\("password"|console\./);
  assert.match(entry, /mode === "signin"[\s\S]*auth\.recovery\.open/);
  assert.doesNotMatch(entry, /useEffect\([\s\S]*requestPasswordRecovery/);
  assert.match(entry, /handleRecoverySubmit[\s\S]*if \(requestPending\.current\) return/);
});

test("choose remains inside the application LocaleProvider", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const providers = readFileSync("app/providers.tsx", "utf8");
  assert.match(layout, /<Providers>\{children\}<\/Providers>/);
  assert.match(providers, /<LocaleProvider>\{children\}<\/LocaleProvider>/);
});

test("recovery template is bilingual and keeps the Supabase confirmation URL", () => {
  const html = readFileSync("supabase/email-templates/recovery.html", "utf8");
  const subject = readFileSync("supabase/email-templates/recovery-subject.txt", "utf8");
  assert.match(subject, /Set your Soul Trace password/);
  assert.match(subject, /Soul Trace 비밀번호 설정/);
  assert.match(html, /Create a new password/);
  assert.match(html, /새 비밀번호를 설정해 주세요/);
  assert.equal((html.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length, 2);
});
