import type { SeasonalPolaroidInputPaths } from "./seasonal-polaroid-input-storage.ts";
import { seasonalPolaroidResultPath } from "./seasonal-polaroid-result-storage.ts";

/**
 * Proposed retention windows. This module only plans cleanup; it does not
 * delete anything until a reviewed scheduled job is approved and deployed.
 */
export const SEASONAL_POLAROID_INPUT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const SEASONAL_POLAROID_RESULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type SeasonalPolaroidCleanupState = {
  jobId: string;
  status: "queued" | "processing" | "succeeded" | "failed";
  updatedAt: string;
  inputPaths: SeasonalPolaroidInputPaths | null;
  resultPath: string | null;
  resultSaved: boolean;
};

export type SeasonalPolaroidCleanupPlan = {
  removeInputPaths: string[];
  removeResultPath: string | null;
  reason: "active" | "too_recent" | "invalid_reference" | "eligible";
};

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
 * eligible. Saved results protect the generated object, while input objects
 * can be removed after the job has reached a terminal state and the grace
 * period has elapsed.
 */
export function planSeasonalPolaroidCleanup(
  state: SeasonalPolaroidCleanupState,
  now = Date.now(),
): SeasonalPolaroidCleanupPlan {
  const inputPaths = ownedInputPaths(state.jobId, state.inputPaths);
  const resultPath = state.inputPaths ? ownedResultPath(state.jobId, state.resultPath, state.inputPaths) : null;
  if (!inputPaths || (state.resultPath && !resultPath)) {
    return { removeInputPaths: [], removeResultPath: null, reason: "invalid_reference" };
  }
  if (state.status === "queued" || state.status === "processing") {
    return { removeInputPaths: [], removeResultPath: null, reason: "active" };
  }
  const updatedAt = Date.parse(state.updatedAt);
  if (!Number.isFinite(updatedAt) || now - updatedAt < SEASONAL_POLAROID_INPUT_RETENTION_MS) {
    return { removeInputPaths: [], removeResultPath: null, reason: "too_recent" };
  }
  const removeResultPath = !state.resultSaved && resultPath && now - updatedAt >= SEASONAL_POLAROID_RESULT_RETENTION_MS
    ? resultPath
    : null;
  return { removeInputPaths: inputPaths, removeResultPath, reason: "eligible" };
}
