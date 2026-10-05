import assert from "node:assert/strict";
import test from "node:test";

import { requestLetterDownloadCode, verifyLetterDownloadCode, type LetterDownloadCodeClient } from "./letter-download-auth.ts";

function mockClient(options: {
  signInError?: unknown;
  verifyError?: unknown;
  session?: unknown | null;
  claimError?: unknown;
} = {}): { client: LetterDownloadCodeClient; otp: unknown[]; claims: number } {
  const otp: unknown[] = [];
  let claims = 0;
  const client: LetterDownloadCodeClient = {
    auth: {
      async signInWithOtp(input) {
        otp.push(input);
        return { error: options.signInError ?? null };
      },
      async verifyOtp() {
        return {
          data: { session: options.session === undefined ? { user: "ready" } : options.session },
          error: options.verifyError ?? null,
        };
      },
    },
    async rpc() {
      claims += 1;
      return { error: options.claimError ?? null };
    },
  };
  return {
    client,
    get otp() {
      return otp;
    },
    get claims() {
      return claims;
    },
  };
}

test("a new letter download account is created with the verification email", async () => {
  const mock = mockClient();
  const result = await requestLetterDownloadCode(mock.client, {
    email: " Guardian@Example.com ",
    redirectTo: "https://example.test/auth/confirm",
    locale: "ko",
  });

  assert.equal(result, "sent");
  assert.deepEqual(mock.otp, [{
    email: "guardian@example.com",
    options: {
      emailRedirectTo: "https://example.test/auth/confirm",
      shouldCreateUser: true,
      data: { locale: "ko" },
    },
  }]);
});

test("an invalid letter download email never requests a code", async () => {
  const mock = mockClient();
  assert.equal(await requestLetterDownloadCode(mock.client, {
    email: "not-an-email",
    redirectTo: "https://example.test/auth/confirm",
    locale: "en",
  }), "invalid_email");
  assert.deepEqual(mock.otp, []);
});

test("a valid letter download code claims existing records and can save the letter", async () => {
  const mock = mockClient();
  assert.equal(await verifyLetterDownloadCode(mock.client, {
    email: "guardian@example.com",
    code: " 123456 ",
  }), "authenticated");
  assert.equal(mock.claims, 1);
});

test("a wrong letter download code does not claim records", async () => {
  const mock = mockClient({ verifyError: new Error("invalid") });
  assert.equal(await verifyLetterDownloadCode(mock.client, {
    email: "guardian@example.com",
    code: "123456",
  }), "invalid_code");
  assert.equal(mock.claims, 0);
  assert.equal(await verifyLetterDownloadCode(mock.client, {
    email: "guardian@example.com",
    code: "12",
  }), "invalid_code");
});
