import "server-only";

import {
  acquireAiGeneration,
  attachAiGenerationInput,
  aiGenerationIdempotencyKey,
  failAiGeneration,
  handoffAiGenerationJob,
  readAiGenerationJob,
  type AiGuardDecision,
} from "./ai-generation-guard";
import type { SeasonalPolaroidQuestionnaire } from "./seasonal-polaroid-contract.ts";
import {
  cleanupSeasonalPolaroidInputs,
  createSeasonalPolaroidInputAttempt,
  uploadSeasonalPolaroidInputs,
  type SeasonalPolaroidInputPaths,
  type SeasonalPolaroidStorage,
} from "./seasonal-polaroid-input-storage.ts";
import { aiGenerationIdentityHash, sha256Hex } from "./ai-generation-guard";
import { createSupabaseServerClient } from "./supabase-server";
import { scheduleAiGenerationWorker } from "./ai-generation-worker-trigger";
import { seasonalPolaroidResultPath } from "./seasonal-polaroid-result-storage.ts";
import { seasonalPolaroidDeveloperTestMode } from "./seasonal-polaroid-access";
import {
  attachSeasonalPolaroidJobOwner,
  detachSeasonalPolaroidJobOwner,
} from "./seasonal-polaroid-persistence";
import {
  bindSeasonalGuestTrial,
  finalizeSeasonalGuestTrial,
  releaseSeasonalGuestTrial,
  reserveSeasonalAccountTrial,
} from "./seasonal-polaroid-guest-trial";

export type SeasonalPolaroidQueuePayload = {
  version: 1;
  themeId: string;
  locale: string;
  answers: {
    themeId: string;
    locale: string;
    petName: string;
    species: string;
    status: string;
    costume: string;
    scene: string;
    vibe: string;
    personalities: string[];
    habit: string;
    favoriteTreat: string;
    customTreat: string;
    callName: string;
    customCallName: string;
    personalDetail: string;
    generationNonce: string;
  };
  inputPhotos: { primary: string; secondary: string | null };
  resultPath: string;
  guestTrialReservationId?: string;
  guestTrialReservationVersion?: number;
  photoMetadata?: {
    primary: { name: string; contentType: "image/jpeg" | "image/png" | "image/webp" };
    secondary: { name: string; contentType: "image/jpeg" | "image/png" | "image/webp" } | null;
  };
};

function normalizedAnswers(answers: SeasonalPolaroidQuestionnaire) {
  return {
    themeId: String(answers.themeId).trim(),
    locale: String(answers.locale).trim(),
    petName: answers.petName.trim(),
    species: String(answers.species).trim(),
    status: String(answers.status).trim(),
    costume: String(answers.costume).trim(),
    scene: String(answers.scene).trim(),
    vibe: String(answers.vibe).trim(),
    personalities: answers.personalities.map((value) => String(value).trim()),
    habit: String(answers.habit).trim(),
    favoriteTreat: String(answers.favoriteTreat).trim(),
    customTreat: String(answers.customTreat ?? "").trim(),
    callName: String(answers.callName).trim(),
    customCallName: String(answers.customCallName ?? "").trim(),
    personalDetail: String(answers.personalDetail ?? "").trim(),
    generationNonce: String(answers.generationNonce ?? "").trim(),
  };
}

export async function seasonalPolaroidRequestHash(args: {
  answers: SeasonalPolaroidQuestionnaire;
  primaryBytes: Uint8Array;
  secondaryBytes?: Uint8Array;
}): Promise<string> {
  const primaryPhotoHash = await sha256Hex(args.primaryBytes);
  const secondaryPhotoHash = args.secondaryBytes ? await sha256Hex(args.secondaryBytes) : null;
  return sha256Hex(JSON.stringify({
    answers: normalizedAnswers(args.answers),
    photos: { primary: primaryPhotoHash, secondary: secondaryPhotoHash },
  }));
}

export function seasonalPolaroidQueuePayload(
  answers: SeasonalPolaroidQuestionnaire,
  inputPhotos: SeasonalPolaroidInputPaths,
  photoMetadata?: SeasonalPolaroidQueuePayload["photoMetadata"],
  guestTrialReservationId?: string,
  guestTrialReservationVersion?: number,
): SeasonalPolaroidQueuePayload {
  const normalized = normalizedAnswers(answers);
  return {
    version: 1,
    themeId: normalized.themeId,
    locale: normalized.locale,
    answers: normalized,
    inputPhotos: { primary: inputPhotos.primary, secondary: inputPhotos.secondary },
    resultPath: seasonalPolaroidResultPath(inputPhotos.primary.split("/")[1] ?? "", inputPhotos.attemptId),
    ...(guestTrialReservationId ? { guestTrialReservationId } : {}),
    ...(guestTrialReservationVersion ? { guestTrialReservationVersion } : {}),
    ...(photoMetadata ? { photoMetadata } : {}),
  };
}

function isPhotoPath(value: unknown, jobId: string, leaf: "primary" | "secondary"): value is string {
  if (typeof value !== "string" || value.includes("..") || value.includes("\\")) return false;
  const prefix = `seasonal-polaroid/${jobId.toLowerCase()}/inputs/`;
  if (!value.startsWith(prefix)) return false;
  const parts = value.slice(prefix.length).split("/");
  return parts.length === 2 && /^[a-zA-Z0-9_-]{16,64}$/.test(parts[0]!) && parts[1] === `${leaf}.input`;
}

function photoAttemptId(value: unknown, jobId: string): string | null {
  if (typeof value !== "string") return null;
  const prefix = "seasonal-polaroid/" + jobId.toLowerCase() + "/inputs/";
  if (!value.startsWith(prefix)) return null;
  const parts = value.slice(prefix.length).split("/");
  return parts.length === 2 && /^[a-zA-Z0-9_-]{16,64}$/.test(parts[0]!) ? parts[0]! : null;
}

function isPhotoMetadata(value: unknown): value is NonNullable<SeasonalPolaroidQueuePayload["photoMetadata"]> {
  if (!value || typeof value !== "object") return false;
  const metadata = value as Partial<NonNullable<SeasonalPolaroidQueuePayload["photoMetadata"]>>;
  const valid = (photo: unknown): photo is { name: string; contentType: "image/jpeg" | "image/png" | "image/webp" } => {
    if (!photo || typeof photo !== "object") return false;
    const item = photo as { name?: unknown; contentType?: unknown };
    return typeof item.name === "string" && item.name.length > 0 && item.name.length <= 160
      && ["image/jpeg", "image/png", "image/webp"].includes(String(item.contentType));
  };
  return valid(metadata.primary) && (metadata.secondary === null || valid(metadata.secondary));
}

/**
 * Queue payloads are database data, not trusted TypeScript values. This
 * parser verifies the job-scoped private paths before the worker downloads
 * anything, while the full questionnaire validator checks option rules after
 * the photos have been materialized as Files.
 */
export function parseSeasonalPolaroidQueuePayload(
  value: unknown,
  jobId: string,
): SeasonalPolaroidQueuePayload | null {
  if (!value || typeof value !== "object" || !/^[a-f0-9]{64}$/i.test(jobId)) return null;
  const payload = value as Partial<SeasonalPolaroidQueuePayload>;
  const photos = payload.inputPhotos;
  const answers = payload.answers;
  if (
    payload.version !== 1 ||
    typeof payload.themeId !== "string" || typeof payload.locale !== "string" ||
    typeof payload.resultPath !== "string" ||
    !photos || typeof photos !== "object" ||
    !isPhotoPath(photos.primary, jobId, "primary") ||
    (photos.secondary !== null && !isPhotoPath(photos.secondary, jobId, "secondary")) ||
    !answers || typeof answers !== "object" ||
    typeof answers.petName !== "string" || typeof answers.species !== "string" ||
    typeof answers.status !== "string" || typeof answers.themeId !== "string" ||
    typeof answers.locale !== "string" || !Array.isArray(answers.personalities) ||
    (payload.photoMetadata !== undefined && !isPhotoMetadata(payload.photoMetadata))
  ) return null;
  if (payload.guestTrialReservationId !== undefined &&
    (typeof payload.guestTrialReservationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.guestTrialReservationId))) return null;
  if (payload.guestTrialReservationVersion !== undefined &&
    (typeof payload.guestTrialReservationVersion !== "number" ||
      !Number.isInteger(payload.guestTrialReservationVersion) || payload.guestTrialReservationVersion < 1)) return null;
  if ((payload.guestTrialReservationId === undefined) !== (payload.guestTrialReservationVersion === undefined)) return null;
  if (payload.themeId !== answers.themeId || payload.locale !== answers.locale) return null;
  const primaryAttempt = photoAttemptId(photos.primary, jobId);
  if (!primaryAttempt || (photos.secondary !== null && photoAttemptId(photos.secondary, jobId) !== primaryAttempt)) return null;
  if (payload.resultPath !== seasonalPolaroidResultPath(jobId, primaryAttempt)) return null;
  return payload as SeasonalPolaroidQueuePayload;
}

/**
 * Admission sequence shared by the gated public route and isolated tests.
 * The route's server-side feature flag remains the activation control;
 * keeping the complete sequence here prevents a future caller from
 * accidentally uploading before the durable idempotency claim.
 */
export async function admitSeasonalPolaroidInternally(args: {
  request: Request;
  answers: SeasonalPolaroidQuestionnaire;
  primary: { bytes: ArrayBuffer; contentType: "image/jpeg" | "image/png" | "image/webp"; name: string };
  secondary?: { bytes: ArrayBuffer; contentType: "image/jpeg" | "image/png" | "image/webp"; name: string };
  requestHash: string;
  /** Server-verified Supabase auth.users ID; never accept this from FormData. */
  identity?: string | null;
  /** Stable HMAC of the verified Supabase user ID. */
  accountHash?: string;
  /** @deprecated Cookie identity retained for legacy isolated callers only. */
  guestHash?: string;
  developerTestMode?: boolean;
}): Promise<AiGuardDecision> {
  const idempotencyKey = await aiGenerationIdempotencyKey("seasonal_polaroid", args.requestHash);
  const developerTestMode = args.developerTestMode === true && seasonalPolaroidDeveloperTestMode();
  const accountHash = args.accountHash ?? args.guestHash;
  if (!developerTestMode && !accountHash) return { decision: "unavailable" };
  const trial = developerTestMode
    ? null
    : await reserveSeasonalAccountTrial({ accountHash: accountHash!, idempotencyKey, requestHash: args.requestHash });
  if (trial?.decision === "unavailable") return { decision: "unavailable" };
  if (trial?.decision === "exhausted") return { decision: "guest_trial_exhausted", trialRemaining: 0 };

  const withTrialRemaining = (decision: AiGuardDecision): AiGuardDecision => {
    if (decision.decision === "guest_trial_exhausted") return decision;
    return trial ? { ...decision, trialRemaining: trial.remaining } as AiGuardDecision : decision;
  };
  const releaseIfOwner = async () => {
    if (trial?.owner) {
      await releaseSeasonalGuestTrial(trial.reservationId, trial.reservationVersion);
    }
  };
  const ownerIdentityHash = args.identity ? aiGenerationIdentityHash(args.identity) : null;
  const attachOwner = async (jobId: string): Promise<boolean> => {
    if (!args.identity || !ownerIdentityHash) return !args.identity;
    return attachSeasonalPolaroidJobOwner({
      jobId,
      ownerUserId: args.identity,
      ownerIdentityHash,
    });
  };

  const decision = await acquireAiGeneration({
    request: args.request,
    kind: "seasonal_polaroid",
    requestHash: args.requestHash,
    identity: args.identity,
    ...(developerTestMode ? { rateLimitIsolationKey: args.requestHash } : {}),
  });
  if ((decision.decision !== "acquired" && decision.decision !== "queued") || !decision.jobId) {
    if (decision.decision === "succeeded" && trial?.owner) {
      const bound = await bindSeasonalGuestTrial({
        reservationId: trial.reservationId,
        reservationVersion: trial.reservationVersion,
        jobId: decision.jobId!,
        requestHash: args.requestHash,
      });
      if (bound) await finalizeSeasonalGuestTrial(trial.reservationId, trial.reservationVersion);
      else await releaseIfOwner();
    } else {
      await releaseIfOwner();
    }
    return withTrialRemaining(decision);
  }

  // A duplicate queued request must not upload or overwrite the first
  // attempt's objects. The RPC's idempotency result is authoritative; callers
  // should only invoke this helper for a newly admitted job.
  const jobId = decision.jobId;
  if (decision.decision === "queued") {
    const existing = await readAiGenerationJob(jobId);
    if (existing?.input_ready) {
      if (!(await attachOwner(jobId))) {
        await releaseIfOwner();
        return { decision: "unavailable" };
      }
      if (trial?.owner && !(await bindSeasonalGuestTrial({ reservationId: trial.reservationId, reservationVersion: trial.reservationVersion, jobId, requestHash: args.requestHash }))) {
        await releaseIfOwner();
        return { decision: "unavailable" };
      }
      // A duplicate request can safely wake a queued job whose earlier
      // after()-trigger was missed. The queue claim RPC still owns the lease.
      scheduleAiGenerationWorker(args.request, { queuedKnown: true });
      return withTrialRemaining(decision);
    }
    // A duplicate request must not race the reservation owner while its
    // private objects are being attached. The owner will wake the worker.
    if (!trial?.owner) return withTrialRemaining(decision);
  }
  const attempt = createSeasonalPolaroidInputAttempt(jobId);
  const supabase = createSupabaseServerClient() as SeasonalPolaroidStorage | null;
  if (!supabase) {
    await failAiGeneration("seasonal_polaroid", args.requestHash, "storage_unavailable");
    await releaseIfOwner();
    return { decision: "unavailable" };
  }
  const uploaded = await uploadSeasonalPolaroidInputs({
    storage: supabase,
    jobId,
    attemptId: attempt.attemptId,
    primary: { bytes: args.primary.bytes, contentType: args.primary.contentType },
    ...(args.secondary ? { secondary: { bytes: args.secondary.bytes, contentType: args.secondary.contentType } } : {}),
  });
  if (!uploaded.ok) {
    await failAiGeneration("seasonal_polaroid", args.requestHash, uploaded.code);
    await releaseIfOwner();
    return { decision: "unavailable" };
  }
  // Associate the verified owner before input_ready can become true. The
  // input attachment may wake a worker immediately, so exposing the queue row
  // first would create a completion race with the owner mapping.
  if (!(await attachOwner(jobId))) {
    await cleanupSeasonalPolaroidInputs(supabase, uploaded.paths);
    await failAiGeneration("seasonal_polaroid", args.requestHash, "seasonal_owner_attach_failed");
    await releaseIfOwner();
    return { decision: "unavailable" };
  }
  const payload = seasonalPolaroidQueuePayload(args.answers, uploaded.paths, {
    primary: { name: args.primary.name, contentType: args.primary.contentType },
    secondary: args.secondary
      ? { name: args.secondary.name, contentType: args.secondary.contentType }
      : null,
  }, trial?.reservationId, trial?.reservationVersion);
  const attached = await attachAiGenerationInput({
    kind: "seasonal_polaroid",
    requestHash: args.requestHash,
    payload: payload as unknown as Record<string, unknown>,
    storagePath: uploaded.paths.primary,
    ownerIdentity: args.identity,
  });
  if (!attached) {
    await cleanupSeasonalPolaroidInputs(supabase, uploaded.paths);
    if (decision.decision === "queued" && (await readAiGenerationJob(jobId))?.input_ready) return decision;
    await detachSeasonalPolaroidJobOwner(jobId);
    await failAiGeneration("seasonal_polaroid", args.requestHash, "queue_input_failed");
    await releaseIfOwner();
    return { decision: "unavailable" };
  }
  if (trial && !(await bindSeasonalGuestTrial({ reservationId: trial.reservationId, reservationVersion: trial.reservationVersion, jobId, requestHash: args.requestHash }))) {
    await detachSeasonalPolaroidJobOwner(jobId);
    await cleanupSeasonalPolaroidInputs(supabase, uploaded.paths);
    await failAiGeneration("seasonal_polaroid", args.requestHash, "guest_trial_bind_failed");
    await releaseIfOwner();
    return { decision: "unavailable" };
  }

  if (decision.decision === "acquired") {
    const handoff = await handoffAiGenerationJob({
      kind: "seasonal_polaroid",
      requestHash: args.requestHash,
    });
    if (handoff === "unavailable") {
      // Do not blindly requeue here: a lease may have expired and been
      // claimed by another worker between the conditional update and this
      // fallback. Leaving the original lease intact lets the existing stale
      // recovery path decide ownership safely. A missed wake is likewise
      // recovered by Cron.
      scheduleAiGenerationWorker(args.request);
      return decision;
    }
  }

  // Newly admitted Seasonal work is now queued, and duplicate triggers are
  // harmless because claim_ai_generation_jobs uses row locks and leases.
  scheduleAiGenerationWorker(args.request, { queuedKnown: true });
  return withTrialRemaining(decision);
}
