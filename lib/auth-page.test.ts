import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  authenticatedAuthDestination,
  authCallbackUrl,
  authEntryPath,
  resolveAuthReturnPath,
  safeAuthErrorPath,
  safeAuthReturnPath,
  safeInternalPath,
} from "./auth-redirect.ts";
import {
  normalizeAuthLocale,
  requestPasswordlessEmail,
  type PasswordlessAuthClient,
} from "./passwordless-auth.ts";

const page = readFileSync("app/auth/page.tsx", "utf8");
const component = readFileSync("components/auth-entry.tsx", "utf8");
const browserAuth = readFileSync("lib/supabase-auth-browser.ts", "utf8");
const serverAuth = readFileSync("lib/supabase-auth-server.ts", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

function mockAuth(error: unknown = null) {
  const calls: unknown[] = [];
  const client: PasswordlessAuthClient = {
    auth: {
      async signInWithOtp(input) {
        calls.push(input);
        return { error };
      },
    },
  };
  return { client, calls };
}

test("auth page uses the server-safe intended destination", () => {
  assert.match(page, /searchParams: Promise<ServerSearchParams>/);
  assert.match(page, /resolveAuthReturnPath\(params\)/);
  assert.match(component, /createSupabaseBrowserAuthClient\(\)/);
  assert.doesNotMatch(component, /SUPABASE_SERVICE_ROLE_KEY|createSupabaseServerClient/);
  assert.match(page, /createSupabaseAuthServerClient\(\)/);
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /redirect\(authenticatedDestination\)/);
});

test("authenticated auth visitors redirect while unauthenticated visitors render", () => {
  assert.equal(
    authenticatedAuthDestination(true, "/living?ch=hospital&p=partner#memory"),
    "/living?ch=hospital&p=partner#memory",
  );
  assert.equal(authenticatedAuthDestination(false, "/living"), null);
  assert.match(page, /if \(authenticatedDestination\) redirect/);
  assert.match(page, /<AuthEntry/);
});

test("browser and server Supabase authentication stay in separate module graphs", () => {
  assert.match(
    component,
    /from "@\/lib\/supabase-auth-browser"/,
  );
  assert.doesNotMatch(browserAuth, /next\/headers|server-only|supabase-server|SERVICE_ROLE/);
  assert.match(serverAuth, /import "server-only"/);
  assert.match(serverAuth, /from "next\/headers"/);
  assert.doesNotMatch(serverAuth, /createBrowserClient/);
});

test("auth page provides localized email, privacy, and signup/sign-in controls", () => {
  assert.match(component, /type="email"/);
  assert.match(component, /PrivacyConsentTrigger/);
  assert.match(component, /PrivacyConsentSheet/);
  assert.match(component, /LanguageToggle/);
  assert.equal(en.auth.continueEmail, "Continue with Email");
  assert.equal(en.auth.registered, "Already registered?");
  assert.equal(en.auth.signIn, "Sign in");
  assert.ok(ko.auth.continueEmail);
  assert.deepEqual(Object.keys(ko.auth).sort(), Object.keys(en.auth).sort());
  assert.match(component, /authCallbackUrl\(window\.location\.origin, returnTo, lang\)/);
  assert.match(component, /locale: lang/);
});

test("signup normalizes email and permits account creation", async () => {
  const { client, calls } = mockAuth();
  assert.equal(await requestPasswordlessEmail(client, {
    email: "  Person@Example.COM ",
    mode: "signup",
    redirectTo: "https://example.test/auth/confirm",
    locale: "en",
  }), "sent");
  assert.deepEqual(calls, [{
    email: "person@example.com",
    options: {
      emailRedirectTo: "https://example.test/auth/confirm",
      shouldCreateUser: true,
      data: { locale: "en" },
    },
  }]);
});

test("sign-in never creates a missing user", async () => {
  const { client, calls } = mockAuth();
  await requestPasswordlessEmail(client, {
    email: "person@example.com",
    mode: "signin",
    redirectTo: "https://example.test/auth/confirm",
    locale: "ko",
  });
  assert.equal((calls[0] as { options: { shouldCreateUser: boolean } }).options.shouldCreateUser, false);
});

test("invalid email never calls authentication", async () => {
  const { client, calls } = mockAuth();
  assert.equal(await requestPasswordlessEmail(client, {
    email: "not-an-email",
    mode: "signup",
    redirectTo: "https://example.test/auth/confirm",
    locale: "en",
  }), "invalid_email");
  assert.equal(calls.length, 0);
});

test("authentication failures remain generic", async () => {
  const { client } = mockAuth({ message: "User does not exist" });
  assert.equal(await requestPasswordlessEmail(client, {
    email: "person@example.com",
    mode: "signin",
    redirectTo: "https://example.test/auth/confirm",
    locale: "en",
  }), "request_failed");
  assert.doesNotMatch(en.auth.errors.request_failed, /exist|account|registered/i);
});

test("p, ch, and additional parameters survive the callback round trip", () => {
  const returnTo = resolveAuthReturnPath({
    returnTo: "/living?ch=pension",
    p: "partner-code",
    campaign: "autumn",
  });
  assert.equal(returnTo, "/living?ch=pension&p=partner-code&campaign=autumn");
  const callback = new URL(authCallbackUrl("https://soultrace.example", returnTo, "ko"));
  assert.equal(callback.searchParams.get("next"), returnTo);
  assert.equal(callback.searchParams.get("locale"), "ko");
  const errorTo = new URL(callback.searchParams.get("errorTo")!, "https://soultrace.example");
  assert.equal(errorTo.searchParams.get("returnTo"), returnTo);
});

test("unsafe return destinations are rejected", () => {
  assert.equal(safeInternalPath("https://evil.example/path", "/choose"), "/choose");
  assert.equal(safeInternalPath("//evil.example/path", "/choose"), "/choose");
  assert.equal(resolveAuthReturnPath({ returnTo: "https://evil.example" }), "/choose");
  assert.equal(safeAuthReturnPath("/auth"), "/choose");
  assert.equal(safeAuthReturnPath("/auth?returnTo=/living"), "/choose");
  assert.equal(safeAuthReturnPath("/auth/confirm?code=ignored"), "/choose");
  assert.equal(safeAuthErrorPath("/auth/confirm", "/living"), "/living");
  assert.equal(safeAuthErrorPath("/auth?returnTo=/living", "/living"), "/auth?returnTo=/living");
});

test("normal auth and unsafe or looping destinations safely fall back to choose", () => {
  assert.equal(resolveAuthReturnPath({}), "/choose");
  assert.equal(resolveAuthReturnPath({ returnTo: "/auth" }), "/choose");
  assert.equal(authenticatedAuthDestination(true, "/auth/confirm"), "/choose");
  assert.equal(authenticatedAuthDestination(true, resolveAuthReturnPath({})), "/choose");
});

test("all four channel authentication entry URLs encode their own destination", () => {
  assert.equal(authEntryPath("/living?ch=pension"), "/auth?returnTo=%2Fliving%3Fch%3Dpension");
  assert.equal(authEntryPath("/living?ch=grooming"), "/auth?returnTo=%2Fliving%3Fch%3Dgrooming");
  assert.equal(authEntryPath("/living?ch=hospital"), "/auth?returnTo=%2Fliving%3Fch%3Dhospital");
  assert.equal(authEntryPath("/memorial?ch=funeral"), "/auth?returnTo=%2Fmemorial%3Fch%3Dfuneral");
  for (const destination of [
    "/living?ch=pension",
    "/living?ch=grooming",
    "/living?ch=hospital",
    "/memorial?ch=funeral",
  ]) {
    assert.doesNotMatch(authEntryPath(destination), /%2Fchoose/i);
  }
});

test("return path preserves fragments and all safe QR parameters", () => {
  assert.equal(resolveAuthReturnPath({
    returnTo: "/memorial?ch=funeral#questions",
    p: "partner-code",
    campaign: "autumn",
    source: ["qr", "poster"],
  }), "/memorial?ch=funeral&p=partner-code&campaign=autumn&source=qr&source=poster#questions");

  assert.equal(
    authEntryPath("/living?ch=pension&p=partner-code&campaign=one&campaign=two#questions"),
    "/auth?returnTo=%2Fliving%3Fch%3Dpension%26p%3Dpartner-code%26campaign%3Done%26campaign%3Dtwo%23questions",
  );
});

test("normal callback defaults to choose and dedicated Life Archive stays separate", () => {
  const normalCallback = new URL(authCallbackUrl("https://soultrace.example", "/choose", "en"));
  assert.equal(normalCallback.searchParams.get("next"), "/choose");

  const lifeArchiveAuth = readFileSync("lib/life-archive-auth.ts", "utf8");
  const callback = readFileSync("app/auth/confirm/route.ts", "utf8");
  assert.match(lifeArchiveAuth, /returnPath = "\/life-archive"/);
  assert.match(callback, /safeAuthConfirmationPath\([\s\S]*?"\/life-archive"/);
});

test("signup metadata accepts only Korean or English and defaults to English", async () => {
  assert.equal(normalizeAuthLocale("ko"), "ko");
  assert.equal(normalizeAuthLocale("en"), "en");
  assert.equal(normalizeAuthLocale("fr"), "en");
  assert.equal(normalizeAuthLocale({ locale: "ko" }), "en");

  for (const [locale, expected] of [["ko", "ko"], ["en", "en"], ["invalid", "en"]] as const) {
    const { client, calls } = mockAuth();
    await requestPasswordlessEmail(client, {
      email: "person@example.com",
      mode: "signup",
      redirectTo: "https://example.test/auth/confirm",
      locale,
    });
    assert.deepEqual(
      (calls[0] as { options: { data: unknown } }).options.data,
      { locale: expected },
    );
  }
});

test("sign-in does not send signup metadata", async () => {
  const { client, calls } = mockAuth();
  await requestPasswordlessEmail(client, {
    email: "person@example.com",
    mode: "signin",
    redirectTo: "https://example.test/auth/confirm",
    locale: "ko",
  });
  assert.equal("data" in (calls[0] as { options: object }).options, false);
});

test("localized authentication failures remain safe", () => {
  assert.ok(en.auth.errors.invalid_link);
  assert.ok(ko.auth.errors.invalid_link);
  assert.doesNotMatch(en.auth.errors.invalid_link, /token|cookie|supabase|stack/i);
  assert.doesNotMatch(ko.auth.errors.invalid_link, /token|cookie|supabase|stack/i);
});

test("pending state blocks duplicate requests and language switching has no auth effect", () => {
  assert.match(component, /if \(requestPending\.current\) return/);
  assert.match(component, /disabled=\{status === "submitting"\}/);
  assert.doesNotMatch(component, /setLang[\s\S]*(?:createPasswordAccount|signInWithPassword)/);
  assert.match(component, /status === "check_email"[\s\S]*auth\.checkEmailTitle/);
  assert.match(component, /mode === "signin" \|\| privacyConsent/);
  assert.doesNotMatch(component, /useEffect\([\s\S]*(?:createPasswordAccount|signInWithPassword)/);
});

test("confirmation keeps legacy Life Archive restoration and adds only a safe error return", () => {
  const callback = readFileSync("app/auth/confirm/route.ts", "utf8");
  const confirmation = readFileSync("lib/auth-confirm.ts", "utf8");
  assert.match(confirmation, /claim_soul_trace_legacy_records/);
  assert.match(callback, /PENDING_LETTER_COOKIE/);
  assert.match(callback, /ACTIVE_SUBMISSION_COOKIE/);
  assert.match(callback, /safeAuthConfirmationPath\([\s\S]*?"\/life-archive"/);
  assert.match(callback, /searchParams\.get\("errorTo"\)/);
});
