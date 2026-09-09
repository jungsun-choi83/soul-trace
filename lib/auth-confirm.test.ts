import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateAuthCallback,
  type AuthConfirmationClient,
} from "./auth-confirm.ts";

function createMockClient(options: {
  codeError?: unknown;
  otpError?: unknown;
  claimError?: unknown;
} = {}) {
  const calls: string[] = [];
  const writtenCookies: string[] = [];
  const client: AuthConfirmationClient = {
    auth: {
      async exchangeCodeForSession() {
        calls.push("exchange");
        if (!options.codeError) writtenCookies.push("session");
        return { error: options.codeError ?? null };
      },
      async verifyOtp() {
        calls.push("verify");
        if (!options.otpError) writtenCookies.push("session");
        return { error: options.otpError ?? null };
      },
      async signOut() {
        calls.push("signOut");
        writtenCookies.splice(0);
      },
    },
    async rpc(name) {
      assert.equal(name, "claim_soul_trace_legacy_records");
      calls.push("claim");
      return { error: options.claimError ?? null };
    },
  };

  return { client, calls, writtenCookies };
}

test("successful PKCE exchange writes the mocked session cookie before claiming", async () => {
  const mock = createMockClient();
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: "safe-test-code",
    tokenHash: null,
    type: null,
  }), "authenticated");
  assert.deepEqual(mock.calls, ["exchange", "claim"]);
  assert.deepEqual(mock.writtenCookies, ["session"]);
});

test("failed PKCE exchange does not claim records or retain a cookie", async () => {
  const mock = createMockClient({ codeError: new Error("mock failure") });
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: "safe-test-code",
    tokenHash: null,
    type: null,
  }), "verification_failed");
  assert.deepEqual(mock.calls, ["exchange"]);
  assert.deepEqual(mock.writtenCookies, []);
});

test("existing token hash callback verifies, writes a cookie, and claims", async () => {
  const mock = createMockClient();
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: null,
    tokenHash: "safe-test-hash",
    type: "email",
  }), "authenticated");
  assert.deepEqual(mock.calls, ["verify", "claim"]);
  assert.deepEqual(mock.writtenCookies, ["session"]);
});

test("recovery token hash callback uses existing OTP verification", async () => {
  const mock = createMockClient();
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: null,
    tokenHash: "safe-test-hash",
    type: "recovery",
  }), "authenticated");
  assert.deepEqual(mock.calls, ["verify", "claim"]);
});

test("failed OTP verification does not claim records", async () => {
  const mock = createMockClient({ otpError: new Error("mock failure") });
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: null,
    tokenHash: "safe-test-hash",
    type: "email",
  }), "verification_failed");
  assert.deepEqual(mock.calls, ["verify"]);
  assert.deepEqual(mock.writtenCookies, []);
});

test("failed or expired recovery token does not establish a session or claim records", async () => {
  const mock = createMockClient({ otpError: new Error("mock expired recovery") });
  assert.equal(await authenticateAuthCallback(mock.client, {
    code: null,
    tokenHash: "safe-test-hash",
    type: "recovery",
  }), "verification_failed");
  assert.deepEqual(mock.calls, ["verify"]);
  assert.deepEqual(mock.writtenCookies, []);
});

test("PKCE code takes precedence when both supported formats are present", async () => {
  const mock = createMockClient();
  await authenticateAuthCallback(mock.client, {
    code: "safe-test-code",
    tokenHash: "safe-test-hash",
    type: "email",
  });
  assert.deepEqual(mock.calls, ["exchange", "claim"]);
});

test("claim failure signs out after either successful authentication format", async () => {
  for (const input of [
    { code: "safe-test-code", tokenHash: null, type: null },
    { code: null, tokenHash: "safe-test-hash", type: "email" as const },
  ]) {
    const mock = createMockClient({ claimError: new Error("mock failure") });
    assert.equal(
      await authenticateAuthCallback(mock.client, input),
      "claim_failed",
    );
    assert.equal(mock.calls.at(-2), "claim");
    assert.equal(mock.calls.at(-1), "signOut");
    assert.deepEqual(mock.writtenCookies, []);
  }
});
