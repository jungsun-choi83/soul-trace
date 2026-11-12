import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  AiGenerationUnconfirmedError,
  MAX_CONSECUTIVE_POLL_FAILURES,
  POLL_ATTEMPT_LIMIT,
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MESSAGE,
  classifyPollOutcome,
  isAiGenerationUnconfirmedError,
  pollAiGenerationResult,
} from "./ai-generation-polling.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

type Step =
  | { kind: "reject" }
  | { kind: "status"; status: number; body?: unknown };

/** Drives the loop through a scripted sequence of status reads. */
function harness(steps: Step[]) {
  const calls: string[] = [];
  const progress: string[] = [];
  let sleeps = 0;
  let index = 0;

  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const step = steps[Math.min(index++, steps.length - 1)]!;
    if (step.kind === "reject") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(step.body ?? {}), { status: step.status });
  }) as unknown as typeof fetch;

  const run = (overrides: Partial<Parameters<typeof pollAiGenerationResult>[0]> = {}) =>
    pollAiGenerationResult({
      kind: "letter",
      jobId: "job-1",
      email: "owner@example.com",
      onStatus: (status) => progress.push(status),
      fetchImpl,
      sleep: async () => { sleeps += 1; },
      ...overrides,
    });

  return { run, calls, progress, get sleeps() { return sleeps; }, get requests() { return calls.length; } };
}

test("one status read is classified correctly for each outcome", () => {
  assert.deepEqual(classifyPollOutcome(null, null), { kind: "transient" });
  assert.deepEqual(classifyPollOutcome({ ok: false, status: 503 }, null), { kind: "transient" });
  assert.deepEqual(classifyPollOutcome({ ok: false, status: 502 }, null), { kind: "transient" });
  assert.deepEqual(classifyPollOutcome({ ok: false, status: 500 }, null), { kind: "transient" });

  assert.equal(classifyPollOutcome({ ok: false, status: 401 }, null).kind, "fatal");
  assert.equal(classifyPollOutcome({ ok: false, status: 403 }, null).kind, "fatal");
  assert.equal(classifyPollOutcome({ ok: false, status: 404 }, null).kind, "fatal");
  assert.equal(classifyPollOutcome({ ok: false, status: 400 }, null).kind, "fatal");

  assert.deepEqual(
    classifyPollOutcome({ ok: true, status: 200 }, { status: "succeeded", result: { letterId: "L1" } }),
    { kind: "succeeded", result: { letterId: "L1" } },
  );
  assert.deepEqual(
    classifyPollOutcome({ ok: true, status: 200 }, { status: "failed", error: "Model refused." }),
    { kind: "failed", error: "Model refused." },
  );
  assert.deepEqual(
    classifyPollOutcome({ ok: true, status: 200 }, { status: "queued" }),
    { kind: "progress", status: "queued" },
  );
  assert.deepEqual(
    classifyPollOutcome({ ok: true, status: 200 }, { status: "processing" }),
    { kind: "progress", status: "processing" },
  );
  // Reachable but uninformative: keep waiting rather than guessing.
  assert.deepEqual(classifyPollOutcome({ ok: true, status: 200 }, null), { kind: "pending" });
  // "succeeded" with no result is not a usable success.
  assert.deepEqual(classifyPollOutcome({ ok: true, status: 200 }, { status: "succeeded" }), { kind: "pending" });
});

test("a temporary network interruption does not end the wait", async () => {
  const h = harness([
    { kind: "reject" },
    { kind: "reject" },
    { kind: "status", status: 200, body: { status: "processing" } },
    { kind: "status", status: 200, body: { status: "succeeded", result: { letterId: "L1" } } },
  ]);
  assert.deepEqual(await h.run(), { letterId: "L1" });
  assert.equal(h.requests, 4);
  assert.deepEqual(h.progress, ["processing"]);
});

test("a 502 from a proxy is retried rather than reported as a failed letter", async () => {
  const h = harness([
    { kind: "status", status: 502, body: {} },
    { kind: "status", status: 503, body: {} },
    { kind: "status", status: 200, body: { status: "succeeded", result: { letterId: "L2" } } },
  ]);
  assert.deepEqual(await h.run(), { letterId: "L2" });
  assert.equal(h.requests, 3);
});

test("the failure streak resets after any readable answer", async () => {
  // Alternating blips must never accumulate into an unconfirmed result.
  const steps: Step[] = [];
  for (let i = 0; i < 40; i += 1) {
    steps.push({ kind: "reject" });
    steps.push({ kind: "status", status: 200, body: { status: "processing" } });
  }
  steps.push({ kind: "status", status: 200, body: { status: "succeeded", result: { ok: true } } });
  const h = harness(steps);
  assert.deepEqual(await h.run(), { ok: true });
  assert.equal(h.progress.length, 40);
});

test("sustained unavailability reports an unconfirmed result, not a failure", async () => {
  const h = harness([{ kind: "reject" }]);
  await assert.rejects(h.run(), (err: unknown) => {
    assert.ok(isAiGenerationUnconfirmedError(err));
    assert.ok(err instanceof AiGenerationUnconfirmedError);
    // The job id survives so the caller can resume the same generation.
    assert.equal(err.jobId, "job-1");
    assert.doesNotMatch(err.message, /fail/i);
    return true;
  });
  // It gives up on the streak ceiling, well inside the overall attempt budget.
  assert.equal(h.requests, MAX_CONSECUTIVE_POLL_FAILURES);
  assert.ok(h.requests < POLL_ATTEMPT_LIMIT);
});

test("a terminal job failure is still reported as a failure, not as unconfirmed", async () => {
  const h = harness([{ kind: "status", status: 200, body: { status: "failed", error: "Generation could not be completed." } }]);
  await assert.rejects(h.run(), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal(isAiGenerationUnconfirmedError(err), false);
    assert.equal(err.message, "Generation could not be completed.");
    return true;
  });
  assert.equal(h.requests, 1);
});

test("authentication and ownership refusals stay terminal and are never retried", async () => {
  for (const status of [401, 403]) {
    const h = harness([{ kind: "status", status, body: { error: "Sign in to check this letter." } }]);
    await assert.rejects(h.run(), (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal(isAiGenerationUnconfirmedError(err), false);
      assert.equal(err.message, "Sign in to check this letter.");
      return true;
    });
    assert.equal(h.requests, 1, `status ${status} must not be retried`);
  }
});

test("terminal success returns immediately without extra requests", async () => {
  const h = harness([{ kind: "status", status: 200, body: { status: "succeeded", result: { letterId: "L3" } } }]);
  assert.deepEqual(await h.run(), { letterId: "L3" });
  assert.equal(h.requests, 1);
  assert.equal(h.sleeps, 0);
});

test("the existing timeout and interval are unchanged", async () => {
  assert.equal(POLL_ATTEMPT_LIMIT, 240);
  assert.equal(POLL_INTERVAL_MS, 3_000);
  // Twelve minutes, as before.
  assert.equal((POLL_ATTEMPT_LIMIT * POLL_INTERVAL_MS) / 60_000, 12);
  const h = harness([{ kind: "status", status: 200, body: { status: "queued" } }]);
  await assert.rejects(h.run({ attemptLimit: 5 }), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal(err.message, POLL_TIMEOUT_MESSAGE);
    return true;
  });
  assert.equal(h.requests, 5);
});

test("polling only ever reads the status endpoint for the one existing job", async () => {
  const h = harness([{ kind: "status", status: 200, body: { status: "succeeded", result: {} } }]);
  await h.run();
  assert.equal(h.calls.length, 1);
  assert.match(h.calls[0]!, /^\/api\/ai-generation\/status\?/);
  assert.match(h.calls[0]!, /kind=letter/);
  assert.match(h.calls[0]!, /jobId=job-1/);
  assert.match(h.calls[0]!, /email=owner%40example\.com/);
  // No generation endpoint is ever contacted from the polling loop.
  const source = readFileSync("lib/ai-generation-polling.ts", "utf8");
  assert.doesNotMatch(source, /generate-letter|method:\s*"POST"/);
});

test("the email is omitted from the query when there is none", async () => {
  const h = harness([{ kind: "status", status: 200, body: { status: "succeeded", result: {} } }]);
  await h.run({ email: null });
  assert.doesNotMatch(h.calls[0]!, /email=/);
});

test("the letter flow consumes the shared poller and keeps the job on an unconfirmed result", () => {
  // The old inline loop is gone and no bare fetch remains in the wait helper.
  assert.match(flow, /return pollAiGenerationResult\(\{/);
  assert.doesNotMatch(flow, /for \(let attempt = 0; attempt < 240/);
  assert.doesNotMatch(flow, /Generation status could not be checked\./);

  // Both call sites still pass the existing job id and email; neither re-posts.
  assert.equal((flow.match(/waitForAiGenerationResult\(/g) ?? []).length, 3);

  // The resume path must not clear the pending job when the result is unconfirmed.
  const resumeCatch = flow.slice(flow.indexOf("}).catch((err) => {"));
  const guarded = resumeCatch.slice(0, resumeCatch.indexOf("}).finally("));
  assert.ok(guarded.indexOf("isAiGenerationUnconfirmedError(err)") < guarded.indexOf("removeItem(pendingGenerationStorageKey)"));
  assert.match(guarded, /setError\(t\("errors\.generationUnconfirmed"\)\);\s*\n\s*return;/);

  // The submit path reports unconfirmed separately from generateFailed.
  assert.match(flow, /isAiGenerationUnconfirmedError\(err\)\s*\n\s*\? t\("errors\.generationUnconfirmed"\)/);
});

test("the unconfirmed message exists in both languages and does not claim failure", () => {
  const en = JSON.parse(readFileSync("locales/en.json", "utf8")) as { errors: Record<string, string> };
  const ko = JSON.parse(readFileSync("locales/ko.json", "utf8")) as { errors: Record<string, string> };
  for (const [name, copy] of [["en", en], ["ko", ko]] as const) {
    const message = copy.errors.generationUnconfirmed;
    assert.equal(typeof message, "string", `${name} must define generationUnconfirmed`);
    assert.ok(message.length > 0);
    assert.notEqual(message, copy.errors.generateFailed);
  }
  assert.doesNotMatch(en.errors.generationUnconfirmed, /failed|could not be (made|created)/i);
  // It tells the customer not to submit again, so no second paid job is started.
  assert.match(en.errors.generationUnconfirmed, /do not submit again/i);
  assert.match(ko.errors.generationUnconfirmed, /다시 제출하지 않아도/);
});

test("an unconfirmed job is kept for a later visit but not re-polled on the same mount", () => {
  // The job id stays in session storage, so reopening the page resumes it.
  const resumeCatch = flow.slice(flow.indexOf("}).catch((err) => {"));
  const guarded = resumeCatch.slice(0, resumeCatch.indexOf("}).finally("));
  assert.match(guarded, /unconfirmedJobRef\.current = err\.jobId;/);
  // Clearing isLoading re-runs the resume effect, so that effect must skip the
  // job it just gave up on instead of looping while the network is down.
  assert.match(flow, /if \(pending\.jobId === unconfirmedJobRef\.current\) return;/);
  const effect = flow.slice(flow.indexOf("const raw = window.sessionStorage.getItem(pendingGenerationStorageKey)"));
  assert.ok(effect.indexOf("unconfirmedJobRef.current") < effect.indexOf("setIsLoading(true)"));
  assert.match(flow, /const unconfirmedJobRef = useRef<string \| null>\(null\);/);
});
