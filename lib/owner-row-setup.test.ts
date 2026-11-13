import assert from "node:assert/strict";
import test from "node:test";

import { logOwnerSetupDiagnostic, runOwnerSetup, sanitizeOwnerSetupDiagnostic } from "./owner-row-setup.ts";

test("owner setup succeeds through the RPC without using fallback", async () => {
  let fallbackCalled = false;
  const result = await runOwnerSetup(
    async () => ({ ok: true }),
    async () => {
      fallbackCalled = true;
      return { ok: true };
    },
  );

  assert.deepEqual(result, { ok: true, source: "rpc" });
  assert.equal(fallbackCalled, false);
});

test("owner setup reports a fallback success and preserves the RPC failure for diagnostics", async () => {
  const rpcError = { code: "42883", message: "function missing", hint: "apply migration" };
  const result = await runOwnerSetup(
    async () => ({ ok: false, error: rpcError }),
    async () => ({ ok: true }),
  );

  assert.deepEqual(result, { ok: true, source: "fallback", rpcError });
});

test("owner setup reports RPC and fallback failures separately", async () => {
  const rpcError = { code: "42883", message: "function missing" };
  const fallbackError = { code: "42501", message: "permission denied", hint: "check grants" };
  const result = await runOwnerSetup(
    async () => ({ ok: false, error: rpcError }),
    async () => ({ ok: false, error: fallbackError }),
  );

  assert.deepEqual(result, { ok: false, rpcError, fallbackError });
});

test("recovered RPC failure is a warning, while complete failure remains an error", () => {
  const calls: Array<{ level: "warn" | "error"; message: unknown; details: Record<string, unknown> }> = [];
  const logger = {
    warn: (message: unknown, details: Record<string, unknown>) => calls.push({ level: "warn", message, details }),
    error: (message: unknown, details: Record<string, unknown>) => calls.push({ level: "error", message, details }),
  };

  logOwnerSetupDiagnostic(false, { stage: "rpc", terminal: false, code: "PGRST202" }, logger);
  logOwnerSetupDiagnostic(true, { stage: "fallback", terminal: true, code: "42501" }, logger);

  assert.deepEqual(calls.map(({ level }) => level), ["warn", "error"]);
  assert.match(String(calls[0].message), /fallback succeeded/);
  assert.equal(calls[0].details.code, "PGRST202");
  assert.equal(calls[1].details.code, "42501");
});

test("diagnostic text redacts emails, bearer tokens, URLs, and secret assignments", () => {
  const message = "failed for pet@example.com Bearer abc https://db.example.test/path?token=x api_key=private-value";
  const safe = sanitizeOwnerSetupDiagnostic(message);
  assert.ok(safe);
  assert.doesNotMatch(safe, /pet@example\.com|Bearer abc|db\.example|private-value/);
  assert.match(safe, /\[redacted-email\]/);
  assert.match(safe, /\[redacted\]/);
});
