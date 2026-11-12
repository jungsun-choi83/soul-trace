/**
 * Status polling for a queued AI generation job.
 *
 * The job already exists and the paid generation has already been requested, so
 * this module never creates or repeats work: it only reads
 * `/api/ai-generation/status` for an existing job id until that job reaches a
 * terminal state.
 *
 * A single status request can fail without the job failing — a dropped
 * connection, a proxy hiccup, a phone changing networks. Treating one of those
 * as a generation failure tells the customer their letter was lost while the
 * worker is still writing it. Transport errors and 5xx responses are therefore
 * retried in place, inside the existing attempt budget. Authentication and
 * other 4xx responses stay terminal so ownership rules are unchanged.
 */

/** Attempts before the existing generation timeout is reported. */
export const POLL_ATTEMPT_LIMIT = 240;
/** Delay between status reads, unchanged from the original loop. */
export const POLL_INTERVAL_MS = 3_000;
/** Consecutive unreachable polls (~60s) before the result is called unconfirmed. */
export const MAX_CONSECUTIVE_POLL_FAILURES = 20;

export const POLL_STATUS_UNREADABLE_MESSAGE = "Generation status could not be checked.";
export const POLL_GENERATION_FAILED_MESSAGE = "Generation could not be completed.";
export const POLL_TIMEOUT_MESSAGE = "Generation is taking longer than expected. Please check again shortly.";

export type AiGenerationStatusPayload = {
  status?: string;
  result?: Record<string, unknown>;
  error?: string;
};

export type PollOutcome =
  /** Terminal success. */
  | { kind: "succeeded"; result: Record<string, unknown> }
  /** Terminal failure reported by the server for this job. */
  | { kind: "failed"; error: string }
  /** Terminal refusal: authentication or another non-retryable status. */
  | { kind: "fatal"; error: string }
  /** The job is still running. */
  | { kind: "progress"; status: "queued" | "processing" }
  /** Reachable but not yet informative; keep waiting. */
  | { kind: "pending" }
  /** The status endpoint was unreachable; the job itself is unaffected. */
  | { kind: "transient" };

/**
 * Raised when polling could not reach a terminal answer. The generation may
 * well have succeeded, so callers must say the result is unconfirmed rather
 * than failed, and must keep the pending job so it can be resumed.
 */
export class AiGenerationUnconfirmedError extends Error {
  readonly jobId: string;
  constructor(jobId: string) {
    super("The letter result could not be confirmed.");
    this.name = "AiGenerationUnconfirmedError";
    this.jobId = jobId;
  }
}

export function isAiGenerationUnconfirmedError(err: unknown): err is AiGenerationUnconfirmedError {
  return err instanceof Error && err.name === "AiGenerationUnconfirmedError";
}

/**
 * Decides what one status read means. `response` is null when the request never
 * produced a response at all.
 */
export function classifyPollOutcome(
  response: Pick<Response, "ok" | "status"> | null,
  payload: AiGenerationStatusPayload | null,
): PollOutcome {
  // The status endpoint was unreachable. This says nothing about the job.
  if (!response) return { kind: "transient" };

  if (!response.ok) {
    // Ownership and authentication answers are final; never retry past them.
    if (response.status === 401 || response.status === 403) {
      return { kind: "fatal", error: payload?.error ?? POLL_STATUS_UNREADABLE_MESSAGE };
    }
    // A server or gateway fault is about the status endpoint, not the job.
    if (response.status >= 500) return { kind: "transient" };
    return { kind: "fatal", error: payload?.error ?? POLL_STATUS_UNREADABLE_MESSAGE };
  }

  if (payload?.status === "succeeded" && payload.result) return { kind: "succeeded", result: payload.result };
  if (payload?.status === "failed") return { kind: "failed", error: payload.error ?? POLL_GENERATION_FAILED_MESSAGE };
  if (payload?.status === "queued" || payload?.status === "processing") {
    return { kind: "progress", status: payload.status };
  }
  return { kind: "pending" };
}

export type PollAiGenerationOptions = {
  kind: "letter";
  jobId: string;
  email: string | null;
  onStatus: (status: "queued" | "processing") => void;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  attemptLimit?: number;
  intervalMs?: number;
  maxConsecutiveFailures?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export async function pollAiGenerationResult({
  kind,
  jobId,
  email,
  onStatus,
  fetchImpl,
  sleep = defaultSleep,
  attemptLimit = POLL_ATTEMPT_LIMIT,
  intervalMs = POLL_INTERVAL_MS,
  maxConsecutiveFailures = MAX_CONSECUTIVE_POLL_FAILURES,
}: PollAiGenerationOptions): Promise<Record<string, unknown>> {
  const request = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < attemptLimit; attempt += 1) {
    const params = new URLSearchParams({ kind, jobId });
    if (email) params.set("email", email);

    let response: Response | null = null;
    let payload: AiGenerationStatusPayload | null = null;
    try {
      response = await request(`/api/ai-generation/status?${params.toString()}`, { cache: "no-store" });
      payload = await response.json().catch(() => null) as AiGenerationStatusPayload | null;
    } catch {
      // The request never produced a response; the job keeps running.
      response = null;
      payload = null;
    }

    const outcome = classifyPollOutcome(response, payload);
    if (outcome.kind === "succeeded") return outcome.result;
    if (outcome.kind === "failed" || outcome.kind === "fatal") throw new Error(outcome.error);

    if (outcome.kind === "transient") {
      consecutiveFailures += 1;
      // Sustained unavailability: the job is not known to have failed, so the
      // caller is told the result is unconfirmed and keeps the job id.
      if (consecutiveFailures >= maxConsecutiveFailures) throw new AiGenerationUnconfirmedError(jobId);
    } else {
      // A readable answer clears the streak, so isolated blips never accumulate.
      consecutiveFailures = 0;
      if (outcome.kind === "progress") onStatus(outcome.status);
    }

    await sleep(intervalMs);
  }

  throw new Error(POLL_TIMEOUT_MESSAGE);
}
