import "server-only";

import { createHmac } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AiGenerationKind = "letter" | "visual_memory" | "seasonal_polaroid";

export type AiGuardDecision =
  | { decision: "acquired"; jobId?: string; trialRemaining?: number }
  | { decision: "queued" | "processing" | "pending" | "rate_limited" | "busy"; retryAfter: number; jobId?: string; trialRemaining?: number }
  | { decision: "succeeded"; result: Record<string, unknown>; jobId?: string; trialRemaining?: number }
  | { decision: "guest_trial_exhausted"; trialRemaining: 0 }
  | { decision: "conflict" }
  | { decision: "unavailable" };

const POLICY = {
  letter: { windowSeconds: 600, ipLimit: 10, identityLimit: 2, ipDailyLimit: 30, identityDailyLimit: 6 },
  visual_memory: { windowSeconds: 600, ipLimit: 6, identityLimit: 0, ipDailyLimit: 15, identityDailyLimit: 0 },
  // Proposed Phase 3B-1 defaults for anonymous Seasonal Polaroid work.
  // These are intentionally conservative and must be approved before the
  // Seasonal endpoint is enabled in production.
  seasonal_polaroid: { windowSeconds: 600, ipLimit: 3, identityLimit: 0, ipDailyLimit: 8, identityDailyLimit: 0 },
} as const;

export const AI_ROUTE_MAX_DURATION_SECONDS = 240;
export const AI_JOB_LEASE_SECONDS = 270;
export const AI_SUCCESS_REUSE_SECONDS = 600;
const DEFAULT_AI_GLOBAL_CONCURRENCY = 8;

function configuredConcurrency(): number {
  const parsed = Number.parseInt(process.env.AI_GENERATION_MAX_CONCURRENCY ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 100) : DEFAULT_AI_GLOBAL_CONCURRENCY;
}

export const AI_GLOBAL_CONCURRENCY = configuredConcurrency();

function guardSecret(): string | null {
  return process.env.AI_GENERATION_GUARD_SECRET?.trim()
    || process.env.SOUL_TRACE_SERVICE_TOKEN?.trim()
    || null;
}

function digest(value: string): string | null {
  const secret = guardSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function aiGenerationIdentityHash(identity: string): string | null {
  return digest(`identity:${identity.trim().toLowerCase()}`);
}

export function requestIp(request: Request): string {
  const value = request.headers.get("x-vercel-forwarded-for")
    || request.headers.get("x-forwarded-for")
    || request.headers.get("x-real-ip")
    || "unknown";
  return value.split(",")[0]!.trim().slice(0, 128) || "unknown";
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function acquireAiGeneration(args: {
  request: Request;
  kind: AiGenerationKind;
  requestHash: string;
  identity?: string | null;
  /** Server-selected namespace used only by the local Seasonal test mode. */
  rateLimitIsolationKey?: string;
}): Promise<AiGuardDecision> {
  const supabase = createSupabaseServerClient();
  const isolatedSubject = args.rateLimitIsolationKey?.trim();
  const ipHash = digest(isolatedSubject ? `seasonal-dev:${isolatedSubject}` : `ip:${requestIp(args.request)}`);
  const identityHash = args.identity ? digest(`identity:${args.identity.trim().toLowerCase()}`) : null;
  if (!supabase || !ipHash || (args.identity && !identityHash)) return { decision: "unavailable" };

  const idempotencyKey = await aiGenerationIdempotencyKey(args.kind, args.requestHash);
  const policy = POLICY[args.kind];
  const { data, error } = await supabase.rpc("acquire_ai_generation_job", {
    p_idempotency_key: idempotencyKey,
    p_request_hash: args.requestHash,
    p_generation_kind: args.kind,
    p_ip_hash: ipHash,
    p_identity_hash: identityHash,
    p_window_seconds: policy.windowSeconds,
    p_ip_limit: policy.ipLimit,
    p_identity_limit: policy.identityLimit,
    p_daily_window_seconds: 86_400,
    p_ip_daily_limit: policy.ipDailyLimit,
    p_identity_daily_limit: policy.identityDailyLimit,
    p_global_limit: AI_GLOBAL_CONCURRENCY,
    p_lease_seconds: AI_JOB_LEASE_SECONDS,
    p_success_reuse_seconds: AI_SUCCESS_REUSE_SECONDS,
  });
  if (error || !data || typeof data !== "object") {
    console.error("[ai-generation-guard] admission failed", { kind: args.kind, code: error?.code });
    return { decision: "unavailable" };
  }
  return data as AiGuardDecision;
}

export async function aiGenerationIdempotencyKey(
  kind: AiGenerationKind,
  requestHash: string,
): Promise<string> {
  return sha256Hex(`${kind}:${requestHash}`);
}

export type AiGenerationJob = {
  idempotency_key: string;
  request_hash: string;
  generation_kind: AiGenerationKind;
  status: "pending" | "queued" | "processing" | "succeeded" | "failed";
  result: Record<string, unknown> | null;
  error_code: string | null;
  attempt_count: number;
  lease_expires_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  input_payload?: Record<string, unknown> | null;
  input_storage_path?: string | null;
  input_ready?: boolean;
  next_attempt_at?: string | null;
  owner_identity_hash?: string | null;
};

export async function attachAiGenerationInput(args: {
  kind: AiGenerationKind;
  requestHash: string;
  payload: Record<string, unknown>;
  storagePath?: string | null;
  ownerIdentity?: string | null;
}): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const idempotencyKey = await aiGenerationIdempotencyKey(args.kind, args.requestHash);
  const ownerIdentityHash = args.ownerIdentity ? aiGenerationIdentityHash(args.ownerIdentity) : null;
  const { data, error } = await supabase.rpc("set_ai_generation_input", {
    p_idempotency_key: idempotencyKey,
    p_request_hash: args.requestHash,
    p_input_payload: args.payload,
    p_input_storage_path: args.storagePath ?? null,
    p_owner_identity_hash: ownerIdentityHash,
  });
  if (error) {
    console.error("[ai-generation-guard] input attachment failed", { kind: args.kind, code: error.code });
    return false;
  }
  return data === true;
}

/**
 * Move a newly admitted, input-ready job into the durable queue so the
 * normal worker claim RPC can take ownership of its lease. The admission RPC
 * may optimistically mark the first available job as `processing`; Seasonal
 * generation is worker-only, so it must be handed back to the queue before a
 * generic worker can claim it.
 *
 * The status and input-ready predicates make this transition atomic. If two
 * triggers race, only one can change `processing` to `queued`; the other sees
 * the already-queued row and may safely trigger the worker as well. The
 * existing claim RPC remains the sole path that assigns a processing lease.
 */
export async function handoffAiGenerationJob(args: {
  kind: AiGenerationKind;
  requestHash: string;
}): Promise<"queued" | "already_queued" | "unavailable"> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return "unavailable";
  const idempotencyKey = await aiGenerationIdempotencyKey(args.kind, args.requestHash);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .update({
      status: "queued",
      lease_expires_at: null,
      next_attempt_at: now,
      updated_at: now,
      last_error: null,
    })
    .eq("idempotency_key", idempotencyKey)
    .eq("request_hash", args.requestHash)
    .eq("generation_kind", args.kind)
    .eq("status", "processing")
    .eq("input_ready", true)
    .gt("lease_expires_at", now)
    .select("idempotency_key");
  if (error) {
    console.error("[ai-generation-guard] worker handoff failed", {
      kind: args.kind,
      code: error.code,
    });
    return "unavailable";
  }
  if (Array.isArray(data) && data.length > 0) return "queued";

  // A concurrent handoff may have won the conditional update. Treat that as
  // success; the existing claim RPC will serialize the actual worker lease.
  const current = await readAiGenerationJob(idempotencyKey);
  return current?.generation_kind === args.kind && current.status === "queued" && current.input_ready
    ? "already_queued"
    : "unavailable";
}

export async function readAiGenerationJob(idempotencyKey: string): Promise<AiGenerationJob | null> {
  const supabase = createSupabaseServerClient();
  if (!supabase || !/^[a-f0-9]{64}$/i.test(idempotencyKey)) return null;
  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey.toLowerCase())
    .maybeSingle();
  if (error || !data) return null;
  return data as AiGenerationJob;
}

export async function claimAiGenerationJobs(limit = AI_GLOBAL_CONCURRENCY): Promise<AiGenerationJob[]> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("claim_ai_generation_jobs", {
    p_limit: Math.max(1, Math.min(limit, 100)),
    p_lease_seconds: AI_JOB_LEASE_SECONDS,
  });
  if (error || !Array.isArray(data)) {
    if (error) console.error("[ai-generation-guard] queue claim failed", { code: error.code });
    return [];
  }
  return data as AiGenerationJob[];
}

export async function requeueAiGenerationJob(idempotencyKey: string, errorCode: string): Promise<boolean> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("requeue_ai_generation_job", {
    p_idempotency_key: idempotencyKey,
    p_error_code: errorCode,
    p_max_attempts: 3,
  });
  if (error) console.error("[ai-generation-guard] queue requeue failed", { code: error.code });
  return data === true;
}

async function settle(
  kind: "complete_ai_generation_job" | "fail_ai_generation_job",
  generationKind: AiGenerationKind,
  requestHash: string,
  value: Record<string, unknown> | string,
): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (!supabase) return;
  const idempotencyKey = await aiGenerationIdempotencyKey(generationKind, requestHash);
  const args = kind === "complete_ai_generation_job"
    ? { p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_result: value }
    : { p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_error_code: value };
  const { error } = await supabase.rpc(kind, args);
  if (error) console.error("[ai-generation-guard] settlement failed", { generationKind, code: error.code });
}

export function completeAiGeneration(kind: AiGenerationKind, requestHash: string, result: Record<string, unknown>) {
  return settle("complete_ai_generation_job", kind, requestHash, result);
}

export function failAiGeneration(kind: AiGenerationKind, requestHash: string, code: string) {
  return settle("fail_ai_generation_job", kind, requestHash, code);
}

export function guardHttpResponse(decision: Exclude<AiGuardDecision, { decision: "acquired" | "succeeded" }>) {
  if (decision.decision === "guest_trial_exhausted") {
    return Response.json(
      {
        error: "Your 2 free Polaroids are complete. You can still revisit your saved results.",
        code: "guest_trial_exhausted",
        trialRemaining: 0,
      },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (decision.decision === "queued" || decision.decision === "processing") {
    return Response.json(
      {
        status: decision.decision,
        jobId: decision.jobId,
        message: "Your generation is waiting. You do not need to submit again.",
      },
      { status: 202, headers: { "Retry-After": String(Math.max(1, decision.retryAfter)) } },
    );
  }
  if (decision.decision === "rate_limited") {
    const retryAfter = Number.isFinite(decision.retryAfter) ? Math.max(1, Math.ceil(decision.retryAfter)) : 600;
    return Response.json(
      {
        // Keep `error` human-readable for the existing Letter and Visual
        // Memory clients. `code` is the stable machine-readable discriminator.
        error: "Generation rate limit reached. Please wait before trying again.",
        code: "rate_limited",
        retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (decision.decision === "busy") {
    const retryAfter = Number.isFinite(decision.retryAfter) ? Math.max(1, Math.ceil(decision.retryAfter)) : 15;
    return Response.json(
      {
        error: "Generation is busy right now. Please wait a moment and try again.",
        code: "busy",
        retryAfter,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (decision.decision === "pending") {
    return Response.json(
      { error: "This generation is already in progress. Please wait for it to finish." },
      { status: 409, headers: { "Retry-After": String(decision.retryAfter) } },
    );
  }
  if (decision.decision === "conflict") {
    return Response.json({ error: "The generation request could not be verified." }, { status: 409 });
  }
  return Response.json(
    { error: "Generation is temporarily unavailable. Please try again shortly." },
    { status: 503, headers: { "Retry-After": "30" } },
  );
}

export const OPENAI_CHAT_OPTIONS = { timeout: 45_000, maxRetries: 0 } as const;
export const OPENAI_IMAGE_OPTIONS = { timeout: 90_000, maxRetries: 0 } as const;
