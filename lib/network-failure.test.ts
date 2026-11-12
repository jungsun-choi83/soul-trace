import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fetchOrNull, jsonOrNull, requestFailed } from "./network-failure.ts";

const trialFlow = readFileSync("components/free-trial-flow.tsx", "utf8");
const memory = readFileSync("components/pet-first-memory.tsx", "utf8");
const dashboard = readFileSync("components/customer-dashboard.tsx", "utf8");

function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = original; });
}

const rejecting = (() => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch;

test("a rejected fetch resolves to null instead of throwing", async () => {
  const result = await withFetch(rejecting, () => fetchOrNull("/api/try/polaroid", { method: "POST" }));
  assert.equal(result, null);
});

test("an aborted request resolves to null rather than escaping the handler", async () => {
  const aborting = (() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }))) as unknown as typeof fetch;
  assert.equal(await withFetch(aborting, () => fetchOrNull("/api/my/pets/p1/photos")), null);
});

test("a successful response is passed through untouched", async () => {
  const body = { timeline: [{ entryId: "e1" }] };
  const ok = (() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))) as unknown as typeof fetch;
  const response = await withFetch(ok, () => fetchOrNull("/api/my/pets/p1/memories"));
  assert.ok(response);
  assert.equal(response.status, 200);
  assert.equal(requestFailed(response), false);
  assert.deepEqual(await jsonOrNull<typeof body>(response), body);
});

test("server error statuses still report as failures, preserving existing behavior", async () => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const response = new Response("{}", { status });
    assert.equal(requestFailed(response), true, `status ${status} must count as failed`);
  }
  assert.equal(requestFailed(null), true);
});

test("a truncated or non-JSON body reads as null instead of throwing", async () => {
  assert.equal(await jsonOrNull(new Response("<html>502</html>", { status: 502 })), null);
  assert.equal(await jsonOrNull(new Response("", { status: 200 })), null);
  assert.equal(await jsonOrNull(null), null);
});

test("a rate-limited JSON body is still readable so its error code survives", async () => {
  const response = new Response(JSON.stringify({ error: "rate_limited" }), { status: 429 });
  assert.equal(requestFailed(response), true);
  assert.deepEqual(await jsonOrNull<{ error: string }>(response), { error: "rate_limited" });
});

test("Free Trial releases pending and never auto-repeats a generation after a dropped connection", () => {
  // No unguarded transport anywhere in the flow.
  assert.doesNotMatch(trialFlow, /await fetch\(/);
  assert.match(trialFlow, /await fetchOrNull\("\/api\/try\/polaroid"/);
  // Pending is released before the failure branches, so the button re-enables.
  const create = trialFlow.slice(trialFlow.indexOf("async function create("));
  assert.ok(create.indexOf("setPending(false)") < create.indexOf("if (!response)"));
  // The transport failure has its own message in both languages.
  assert.match(trialFlow, /연결이 끊겨 완료를 확인하지 못했어요/);
  assert.match(trialFlow, /The connection dropped, so this could not be confirmed/);
  // Duplicate submits are blocked while a request is in flight.
  assert.match(trialFlow, /if \(!file \|\| pending\) return;/);
  // The idempotency key is only created when absent, so a manual retry reuses
  // it and the server de-duplicates. Nothing clears it on failure.
  assert.match(trialFlow, /if \(!key\.current\) key\.current = createIdempotencyKey\(\);/);
  const failureBranch = create.slice(create.indexOf("if (!response)"), create.indexOf("setArtwork"));
  assert.doesNotMatch(failureBranch, /key\.current = ""/);
  assert.doesNotMatch(failureBranch, /createIdempotencyKey/);
  // No automatic retry of the generation request.
  assert.doesNotMatch(trialFlow, /setTimeout\([\s\S]{0,80}create\(/);
  assert.doesNotMatch(create, /for \(|while \(|retr(y|ies)Left/);
  // The user's inputs are untouched by the failure path.
  assert.doesNotMatch(failureBranch, /setFile\(|setName\(|setStyle\(|setOccasion\(/);
});

test("Memories upload releases saving and shows the retryable error on a dropped connection", () => {
  assert.doesNotMatch(memory, /await fetch\(/);
  // Every request path in this screen goes through the guarded transport.
  assert.equal((memory.match(/await fetchOrNull\(/g) ?? []).length, 6);
  for (const path of ["/photos`", "/videos`", "/memories`"]) {
    assert.ok(memory.includes(`await fetchOrNull(\`/api/my/pets/\${petId}${path}`), `${path} must use fetchOrNull`);
  }
  // Saving is released before the failure branch in each upload path.
  for (const name of ["postPhoto", "saveStory", "postVideo"]) {
    const fn = memory.slice(memory.indexOf(`async function ${name}(`));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    assert.ok(body.includes("setSaving(false)"), `${name} must release saving`);
    assert.ok(body.indexOf("setSaving(false)") < body.indexOf("requestFailed(response)"), `${name} must release saving before failing`);
    assert.ok(body.includes("setSaveError(true)"), `${name} must surface the error`);
  }
  // The album load releases loading and offers the existing retry button.
  const load = memory.slice(memory.indexOf("const load = useCallback("));
  assert.ok(load.indexOf("setLoading(false)") < load.indexOf("requestFailed(response)"));
  assert.match(memory, /setLoadError\(true\)/);
  assert.match(memory, /onClick=\{\(\) => void load\(\)\}[\s\S]{0,40}\{copy\.retry\}/);
  // Duplicate submissions are blocked while a save is in flight.
  assert.match(memory, /if \(saving \|\| photoScanning \|\| photoSelectionError\) return;/);
  assert.equal((memory.match(/if \(saving\) return;/g) ?? []).length, 2);
  // A failed save must not reset the form or navigate away, so the chosen
  // photos, dates, and typed text survive for the retry.
  for (const name of ["postPhoto", "saveStory", "postVideo"]) {
    const fn = memory.slice(memory.indexOf(`async function ${name}(`));
    const body = fn.slice(0, fn.indexOf("\n  }"));
    const failure = body.slice(body.indexOf("requestFailed(response)"), body.indexOf("finish(form"));
    assert.doesNotMatch(failure, /form\.reset\(\)|router\.push|setChosen\(0\)/, `${name} must preserve input on failure`);
  }
  // finish() is what clears the form, and it runs only after success.
  assert.match(memory, /function finish\(form: HTMLFormElement, wasEmpty: boolean\) \{\s*\n\s*form\.reset\(\);/);
});

test("Living/Memorial status update releases saving and leaves the status unchanged on failure", () => {
  assert.doesNotMatch(dashboard, /await fetch\(/);
  assert.match(dashboard, /await fetchOrNull\(`\/api\/my\/pets\/\$\{active\.petId\}`/);
  const choose = dashboard.slice(dashboard.indexOf("async function chooseBranch("));
  const body = choose.slice(0, choose.indexOf("\n  }"));
  // Saving is released first, which re-enables both buttons for a manual retry.
  assert.ok(body.indexOf("setSavingBranch(false)") < body.indexOf("requestFailed(response)"));
  assert.ok(body.includes("setBranchError(true)"));
  // The optimistic status is only committed after a successful response.
  assert.ok(body.indexOf("requestFailed(response)") < body.indexOf("setChosen("));
  const failure = body.slice(body.indexOf("requestFailed(response)"), body.indexOf("setChosen("));
  assert.doesNotMatch(failure, /setChosen\(|router\.refresh\(\)/);
  // Duplicate submissions are blocked while the PATCH is in flight.
  assert.match(dashboard, /if \(!active \|\| savingBranch\) return;/);
  // The error uses the existing bilingual copy key rather than a new string.
  assert.match(dashboard, /\{copy\.branchSaveError\}/);
  assert.match(dashboard, /disabled=\{saving\}/);
});

test("the shared error copy exists in both languages", () => {
  const copy = readFileSync("lib/storybook-copy.ts", "utf8");
  for (const key of ["saveError", "loadError", "branchSaveError", "retry"]) {
    assert.equal((copy.match(new RegExp(`^\\s+${key}:`, "gm")) ?? []).length, 2, `${key} must exist in ko and en`);
  }
});
