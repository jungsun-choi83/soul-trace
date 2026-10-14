import type { SeasonalPolaroidInputPaths } from "./seasonal-polaroid-input-storage.ts";
import { seasonalPolaroidResultPath } from "./seasonal-polaroid-result-storage.ts";

/**
 * Proposed input retention window. Inputs are no longer needed after a
 * terminal job has had a full grace period: retries/recovery have ended and
 * completed-image delivery uses the separate result object. Result objects
 * are intentionally never eligible for automatic deletion in this phase.
 */
export const SEASONAL_POLAROID_INPUT_RETENTION_MS = 24 * 60 * 60 * 1000;

const SEASONAL_POLAROID_INPUT_PATH =
  /^seasonal-polaroid\/[a-f0-9]{64}\/inputs\/[A-Za-z0-9_-]{16,64}\/(?:primary|secondary)\.input$/i;

export type SeasonalPolaroidObjectMetadata = {
  path: string;
  createdAt: string;
};

export type SeasonalPolaroidCleanupState = {
  jobId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  updatedAt: string;
  inputPaths: SeasonalPolaroidInputPaths | null;
  resultPath: string | null;
  /** Kept for future gallery-aware policies; all results are protected now. */
  resultSaved: boolean;
};

export type SeasonalPolaroidCleanupPlan = {
  removeInputPaths: string[];
  removeResultPath: string | null;
  reason: "active" | "too_recent" | "invalid_reference" | "eligible";
};

export type SeasonalPolaroidCleanupStorage = {
  storage: {
    from(bucket: string): {
      remove(paths: string[]): Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type SeasonalPolaroidCleanupExecution = {
  plan: SeasonalPolaroidCleanupPlan;
  removedPaths: string[];
  removalFailed: boolean;
};

/**
 * Plan cleanup for objects that were uploaded before a queue row could be
 * attached. Listing is intentionally kept outside this module: callers must
 * obtain a complete, authoritative reference set before asking for orphan
 * candidates. An incomplete listing fails closed and returns no candidates.
 */
export function planSeasonalPolaroidOrphanCleanup(args: {
  objects: readonly SeasonalPolaroidObjectMetadata[];
  referencedPaths: ReadonlySet<string>;
  referencesComplete: boolean;
  now?: number;
}): string[] {
  if (!args.referencesComplete) return [];
  const now = args.now ?? Date.now();
  const candidates: string[] = [];
  for (const object of args.objects) {
    if (!SEASONAL_POLAROID_INPUT_PATH.test(object.path)) continue;
    if (args.referencedPaths.has(object.path)) continue;
    const createdAt = Date.parse(object.createdAt);
    if (!Number.isFinite(createdAt) || now - createdAt < SEASONAL_POLAROID_INPUT_RETENTION_MS) continue;
    candidates.push(object.path);
  }
  return candidates;
}

function ownedInputPaths(jobId: string, paths: SeasonalPolaroidInputPaths | null): string[] | null {
  if (!paths || !/^[a-f0-9]{64}$/i.test(jobId) || !/^[a-zA-Z0-9_-]{16,64}$/.test(paths.attemptId)) return null;
  const prefix = `seasonal-polaroid/${jobId.toLowerCase()}/inputs/${paths.attemptId}/`;
  const expectedPrimary = `${prefix}primary.input`;
  const expectedSecondary = `${prefix}secondary.input`;
  if (paths.primary !== expectedPrimary) return null;
  if (paths.secondary !== null && paths.secondary !== expectedSecondary) return null;
  return [paths.primary, ...(paths.secondary ? [paths.secondary] : [])];
}

function ownedResultPath(jobId: string, path: string | null, inputPaths: SeasonalPolaroidInputPaths): string | null {
  if (!path || !/^[a-f0-9]{64}$/i.test(jobId)) return null;
  return path === seasonalPolaroidResultPath(jobId, inputPaths.attemptId) ? path : null;
}

/**
 * A cleanup runner should call this after reading authoritative job/result
 * state in one server-side transaction or snapshot. Active jobs are never
 * eligible. Every completed result is protected, regardless of whether it
 * has been saved, while input objects can be removed after the job reaches a
 * terminal state and the grace period has elapsed.
 */
export function planSeasonalPolaroidCleanup(
  state: SeasonalPolaroidCleanupState,
  now = Date.now(),
): SeasonalPolaroidCleanupPlan {
  const inputPaths = ownedInputPaths(state.jobId, state.inputPaths);
  const resultReference = state.inputPaths ? ownedResultPath(state.jobId, state.resultPath, state.inputPaths) : null;
  if (!inputPaths || (state.resultPath && !resultReference)) {
    return { removeInputPaths: [], removeResultPath: null, reason: "invalid_reference" };
  }
  if (state.status === "queued" || state.status === "processing") {
    return { removeInputPaths: [], removeResultPath: null, reason: "active" };
  }
  const updatedAt = Date.parse(state.updatedAt);
  if (!Number.isFinite(updatedAt) || now - updatedAt < SEASONAL_POLAROID_INPUT_RETENTION_MS) {
    return { removeInputPaths: [], removeResultPath: null, reason: "too_recent" };
  }
  // Result deletion is deliberately disabled until the My Polaroids gallery,
  // user-deletion semantics, and a complete retention policy are approved.
  return { removeInputPaths: inputPaths, removeResultPath: null, reason: "eligible" };
}

/**
 * Execute one already-authorized cleanup plan against the private AI bucket.
 *
 * The caller must build `state` from an authoritative terminal job snapshot
 * and the saved-results lookup. This function deliberately has no broad
 * bucket listing or delete-by-prefix operation: every path is reconstructed
 * from the job ID and attempt ID, so concurrent attempts cannot delete one
 * another's objects. Storage deletion is idempotent; a later retry simply
 * removes the same attempt-scoped paths again.
 */
export async function executeSeasonalPolaroidCleanup(args: {
  storage: SeasonalPolaroidCleanupStorage;
  state: SeasonalPolaroidCleanupState;
  now?: number;
}): Promise<SeasonalPolaroidCleanupExecution> {
  const plan = planSeasonalPolaroidCleanup(args.state, args.now);
  if (plan.reason !== "eligible") {
    return { plan, removedPaths: [], removalFailed: false };
  }

  const paths = plan.removeInputPaths;
  if (!paths.length) {
    return {
      plan,
      removedPaths: [],
      removalFailed: false,
    };
  }

  try {
    const { error } = await args.storage.storage
      .from("ai-generation-inputs")
      .remove(paths);
    return {
      plan,
      removedPaths: error ? [] : paths,
      removalFailed: Boolean(error),
    };
  } catch {
    return { plan, removedPaths: [], removalFailed: true };
  }
}
