import { SEASONAL_POLAROID_INPUT_BUCKET } from "./seasonal-polaroid-input-storage.ts";

/**
 * Seasonal results deliberately use the existing private AI bucket.  Keeping
 * the object key in the queue result (instead of a data URL) avoids putting
 * large image payloads in Postgres and makes accidental public access harder.
 */
export const SEASONAL_POLAROID_RESULT_BUCKET = SEASONAL_POLAROID_INPUT_BUCKET;

export type SeasonalPolaroidResultStorage = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: boolean; cacheControl?: string },
      ): Promise<{ error: { message?: string } | null }>;
      download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }>;
    };
  };
};

function assertJobId(jobId: string): string {
  if (!/^[a-f0-9]{64}$/i.test(jobId)) throw new Error("invalid seasonal polaroid job id");
  return jobId.toLowerCase();
}

function isOwnedResultPath(path: string): boolean {
  return /^seasonal-polaroid\/[a-f0-9]{64}\/result\/[a-zA-Z0-9_-]{16,64}\.jpg$/i.test(path);
}

export function isSeasonalPolaroidResultPath(jobId: string, path: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(jobId)) return false;
  return path.toLowerCase().startsWith("seasonal-polaroid/" + jobId.toLowerCase() + "/result/")
    && isOwnedResultPath(path);
}

/** A stable key is safe for retries of one leased job and is never a public URL. */
export function seasonalPolaroidResultPath(jobId: string, attemptId: string): string {
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(attemptId)) throw new Error("invalid seasonal polaroid result token");
  return "seasonal-polaroid/" + assertJobId(jobId) + "/result/" + attemptId + ".jpg";
}

/**
 * Return the result prefix used for ownership checks and garbage collection.
 * Cleanup code must only remove objects referenced by an abandoned job; this
 * module intentionally has no broad bucket-delete operation.
 */
export function seasonalPolaroidResultPrefix(jobId: string): string {
  return `seasonal-polaroid/${assertJobId(jobId)}/result/`;
}

export async function uploadSeasonalPolaroidResultImage(args: {
  storage: SeasonalPolaroidResultStorage;
  objectKey: string;
  bytes: ArrayBuffer;
}): Promise<{ ok: true } | { ok: false; code: "result_upload_failed" }> {
  if (!isOwnedResultPath(args.objectKey)) {
    return { ok: false, code: "result_upload_failed" };
  }
  try {
    const { error } = await args.storage.storage.from(SEASONAL_POLAROID_RESULT_BUCKET).upload(
      args.objectKey,
      args.bytes,
      { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" },
    );
    return error ? { ok: false, code: "result_upload_failed" } : { ok: true };
  } catch {
    return { ok: false, code: "result_upload_failed" };
  }
}

export async function downloadSeasonalPolaroidResultImage(args: {
  storage: SeasonalPolaroidResultStorage;
  objectKey: string;
}): Promise<Blob | null> {
  if (!isOwnedResultPath(args.objectKey)) return null;
  try {
    const { data, error } = await args.storage.storage.from(SEASONAL_POLAROID_RESULT_BUCKET).download(args.objectKey);
    return error || !data ? null : data;
  } catch {
    return null;
  }
}
