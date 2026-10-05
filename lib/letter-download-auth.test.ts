import assert from "node:assert/strict";
import test from "node:test";

import { requestLetterDownloadCode, verifyLetterDownloadCode, type LetterDownloadCodeClient } from "./letter-download-auth.ts";

function mockClient(options: {
  signInError?: unknown;
  verifyError?: unknown;
  session?: unknown | null;
} = {}): { client: LetterDownloadCodeClient; otp: unknown[] } {
  const otp: unknown[] = [];
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
  };
  return {
    client,
    get otp() {
      return otp;
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

test("a valid letter download code authenticates without claiming older records", async () => {
  const mock = mockClient();
  assert.equal(await verifyLetterDownloadCode(mock.client, {
    email: "guardian@example.com",
    code: " 123456 ",
  }), "authenticated");
  assert.equal("rpc" in mock.client, false);
});

test("a wrong or expired letter download code does not authenticate", async () => {
  assert.equal(await verifyLetterDownloadCode(mockClient({ verifyError: new Error("invalid") }).client, {
    email: "guardian@example.com",
    code: "123456",
  }), "invalid_code");
  assert.equal(await verifyLetterDownloadCode(mockClient({ verifyError: { code: "otp_expired", message: "Token has expired" } }).client, {
    email: "guardian@example.com",
    code: "123456",
  }), "expired");
  assert.equal(await verifyLetterDownloadCode(mockClient().client, {
    email: "guardian@example.com",
    code: "12",
  }), "invalid_code");
});
