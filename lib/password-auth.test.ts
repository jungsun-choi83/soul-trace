import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { authCallbackUrl } from "./auth-redirect.ts";
import { createPasswordAccount, signInWithPassword, type MainPasswordAuthClient } from "./password-auth.ts";
import { passwordValidationError } from "./password-recovery.ts";

function mockClient(options: { signupSession?: unknown; signupError?: { code?: string }; signinSession?: unknown; signinError?: { code?: string } } = {}) {
  const signupCalls: unknown[] = [];
  const signinCalls: unknown[] = [];
  const client: MainPasswordAuthClient = { auth: {
    async signUp(input) {
      signupCalls.push(input);
      return { data: { session: options.signupSession ?? null }, error: options.signupError ?? null };
    },
    async signInWithPassword(input) {
      signinCalls.push(input);
      return { data: { session: options.signinSession ?? null }, error: options.signinError ?? null };
    },
  } };
  return { client, signupCalls, signinCalls };
}

test("password signup normalizes email, sends validated locale and safe callback", async () => {
  for (const [locale, expected] of [["en", "en"], ["ko", "ko"], ["invalid", "en"]] as const) {
    const mock = mockClient();
    const callback = authCallbackUrl("https://example.test", "/living?ch=pension&p=partner#answers", locale);
    assert.equal(await createPasswordAccount(mock.client, { email: " Person@Example.COM ", password: "password-8", redirectTo: callback, locale }), "check_email");
    assert.deepEqual(mock.signupCalls, [{
      email: "person@example.com",
      password: "password-8",
      options: { emailRedirectTo: callback, data: { locale: expected } },
    }]);
    assert.equal(mock.signinCalls.length, 0);
  }
});

test("signup check-email and immediate-session responses are handled separately", async () => {
  assert.equal(await createPasswordAccount(mockClient().client, { email: "a@b.co", password: "password", redirectTo: "https://example.test/auth/confirm", locale: "en" }), "check_email");
  assert.equal(await createPasswordAccount(mockClient({ signupSession: {} }).client, { email: "a@b.co", password: "password", redirectTo: "https://example.test/auth/confirm", locale: "en" }), "authenticated");
});

test("password sign-in sends credentials only to signInWithPassword and sends no email", async () => {
  const mock = mockClient({ signinSession: {} });
  assert.equal(await signInWithPassword(mock.client, { email: " Person@Example.COM ", password: "password-8" }), "authenticated");
  assert.deepEqual(mock.signinCalls, [{ email: "person@example.com", password: "password-8" }]);
  assert.equal(mock.signupCalls.length, 0);
});

test("sign-in errors remain generic while unconfirmed email has a safe state", async () => {
  assert.equal(await signInWithPassword(mockClient({ signinError: { code: "invalid_credentials" } }).client, { email: "a@b.co", password: "password" }), "invalid_credentials");
  assert.equal(await signInWithPassword(mockClient({ signinError: { code: "email_not_confirmed" } }).client, { email: "a@b.co", password: "password" }), "email_not_confirmed");
  assert.equal(await signInWithPassword(mockClient({ signinError: { code: "user_not_found" } }).client, { email: "a@b.co", password: "password" }), "invalid_credentials");
});

test("shared password validation covers missing, minimum, and mismatch", () => {
  assert.equal(passwordValidationError("", ""), "required");
  assert.equal(passwordValidationError("short", "short"), "too_short");
  assert.equal(passwordValidationError("long-enough", "different"), "mismatch");
  assert.equal(passwordValidationError("long-enough", "long-enough"), null);
});

test("main auth UI has credential fields, consent, recovery actions, and clears passwords", () => {
  const component = readFileSync("components/auth-entry.tsx", "utf8");
  assert.match(component, /createPasswordAccount/);
  assert.match(component, /signInWithPassword/);
  assert.doesNotMatch(component, /requestPasswordlessEmail|signInWithOtp/);
  assert.match(component, /type="password"/);
  assert.match(component, /new-password/);
  assert.match(component, /current-password/);
  assert.match(component, /auth-password-confirmation/);
  assert.match(component, /PrivacyConsentTrigger/);
  assert.match(component, /auth\.forgotPassword/);
  assert.match(component, /auth\.recovery\.open/);
  assert.match(component, /setPassword\(""\)/);
  assert.match(component, /setPasswordConfirmation\(""\)/);
  assert.doesNotMatch(component, /localStorage|sessionStorage|indexedDB|searchParams\.set\("password"/);
  assert.match(component, /logAuthFailure\("browser-client", error\)/);
});

test("authentication diagnostics contain stages without passing email or password", () => {
  const helper = readFileSync("lib/auth-diagnostics.ts", "utf8");
  const passwordAuth = readFileSync("lib/password-auth.ts", "utf8");
  assert.match(helper, /\[redacted-email\]/);
  assert.match(helper, /\[redacted-token\]/);
  assert.doesNotMatch(passwordAuth, /logAuthFailure\([^\n]+email|logAuthFailure\([^\n]+password/);
  assert.match(passwordAuth, /logAuthFailure\("signup", error\)/);
  assert.match(passwordAuth, /logAuthFailure\("signin", error\)/);
});

test("English and Korean credential labels match the approved interface", () => {
  const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
  const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));
  assert.deepEqual(
    [en.form.emailLabel, en.auth.password, en.auth.confirmPassword, en.auth.signUpButton, en.auth.signInButton, en.auth.forgotPassword, en.auth.createAccount],
    ["Email address", "Password", "Confirm password", "Sign Up", "Sign In", "Forgot password?", "Create account"],
  );
  assert.deepEqual(
    [ko.form.emailLabel, ko.auth.password, ko.auth.confirmPassword, ko.auth.signUpButton, ko.auth.signInButton, ko.auth.forgotPassword, ko.auth.createAccount],
    ["이메일 주소", "비밀번호", "비밀번호 확인", "가입하기", "로그인", "비밀번호를 잊으셨나요?", "계정 만들기"],
  );
  assert.notEqual(en.auth.passwordlessGuidance, "");
  assert.notEqual(ko.auth.passwordlessGuidance, "");
});

test("Life Archive remains the only application passwordless consumer", () => {
  const lifeArchive = readFileSync("lib/life-archive-auth.ts", "utf8");
  const helper = readFileSync("lib/passwordless-auth.ts", "utf8");
  assert.match(lifeArchive, /signInWithOtp/);
  assert.match(lifeArchive, /returnPath = "\/life-archive"/);
  assert.match(helper, /signInWithOtp/);
});
