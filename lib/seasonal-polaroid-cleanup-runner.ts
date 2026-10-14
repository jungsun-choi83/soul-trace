import type { SupabaseClient } from "@supabase/supabase-js";

import {
  executeSeasonalPolaroidCleanup,
  planSeasonalPolaroidCleanup,
  type SeasonalPolaroidCleanupStorage,
} from "./seasonal-polaroid-cleanup.ts";
import type { SeasonalPolaroidInputPaths } from "./seasonal-polaroid-input-storage.ts";

export type SeasonalCleanupPayload = {
  inputPhotos: SeasonalPolaroidInputPaths;
  resultPath: string;
};

export type SeasonalCleanupPayloadParser = (
  value: unknown,
  jobId: string,
) => SeasonalCleanupPayload | null;

export type SeasonalCleanupRunnerOptions = {
  db: SupabaseClient;
  parsePayload: SeasonalCleanupPayloadParser;
  dryRun?: boolean;
  deletionEnabled?: boolean;
  now?: number;
  limit?: number;
};

export type SeasonalCleanupRunnerReport = {
  dryRun: boolean;
  deletionEnabled: boolean;
  scanned: number;
  eligible: number;
  removed: number;
  removalFailed: number;
  skipped: number;
  reasons: Record<string, number>;
};

type CleanupJobRow = {
  idempotency_key: string;
  status: "succeeded" | "failed";
  updated_at: string;
  input_payload: unknown;
};

function increment(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function sameSnapshot(a: CleanupJobRow, b: CleanupJobRow): boolean {
  return a.idempotency_key === b.idempotency_key
    && a.status === b.status
    && a.updated_at === b.updated_at;
}

/**
 * Runs the Seasonal input-only cleanup policy against an authoritative
 * service-role snapshot. It deliberately has no bucket listing and never
 * deletes result objects. The route supplies a parser that validates the
 * job-scoped paths before this runner can remove anything.
 */
export async function runSeasonalPolaroidCleanup(
  options: SeasonalCleanupRunnerOptions,
): Promise<SeasonalCleanupRunnerReport> {
  const dryRun = options.dryRun !== false;
  const deletionEnabled = options.deletionEnabled === true;
  const now = options.now ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
  const report: SeasonalCleanupRunnerReport = {
    dryRun: dryRun || !deletionEnabled,
    deletionEnabled,
    scanned: 0,
    eligible: 0,
    removed: 0,
    removalFailed: 0,
    skipped: 0,
    reasons: {},
  };

  const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await options.db
    .from("ai_generation_jobs")
    .select("idempotency_key,status,updated_at,input_payload")
    .eq("generation_kind", "seasonal_polaroid")
    .in("status", ["succeeded", "failed"])
    .lte("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error("seasonal_cleanup_query_failed");

  const rows = (Array.isArray(data) ? data : []) as CleanupJobRow[];
  report.scanned = rows.length;
  for (const row of rows) {
    const payload = options.parsePayload(row.input_payload, row.idempotency_key);
    if (!payload) {
      report.skipped += 1;
      increment(report.reasons, "invalid_reference");
      continue;
    }
    const state = {
      jobId: row.idempotency_key,
      status: row.status,
      updatedAt: row.updated_at,
      inputPaths: payload.inputPhotos,
      resultPath: payload.resultPath,
      resultSaved: false,
    } as const;
    const plan = planSeasonalPolaroidCleanup(state, now);
    if (plan.reason !== "eligible") {
      report.skipped += 1;
      increment(report.reasons, plan.reason);
      continue;
    }
    report.eligible += 1;
    if (report.dryRun) continue;

    // Re-read immediately before deletion. A retry/recovery or a new attempt
    // must win over a stale cleanup snapshot; only the unchanged terminal row
    // is allowed to authorize removal of its attempt-scoped inputs.
    const { data: currentData, error: currentError } = await options.db
      .from("ai_generation_jobs")
      .select("idempotency_key,status,updated_at,input_payload")
      .eq("idempotency_key", row.idempotency_key)
      .eq("generation_kind", "seasonal_polaroid")
      .maybeSingle();
    const current = currentData as CleanupJobRow | null;
    if (currentError || !current || !sameSnapshot(row, current)) {
      report.skipped += 1;
      increment(report.reasons, "changed_before_delete");
      continue;
    }
    const currentPayload = options.parsePayload(current.input_payload, current.idempotency_key);
    if (!currentPayload
      || currentPayload.inputPhotos.primary !== payload.inputPhotos.primary
      || currentPayload.inputPhotos.secondary !== payload.inputPhotos.secondary) {
      report.skipped += 1;
      increment(report.reasons, "changed_before_delete");
      continue;
    }
    const execution = await executeSeasonalPolaroidCleanup({
      storage: options.db as unknown as SeasonalPolaroidCleanupStorage,
      state,
      now,
    });
    if (execution.removalFailed) {
      report.removalFailed += 1;
      increment(report.reasons, "storage_remove_failed");
    } else {
      report.removed += execution.removedPaths.length;
    }
  }
  return report;
}
