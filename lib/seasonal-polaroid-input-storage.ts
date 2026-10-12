import { randomUUID } from "node:crypto";

export const SEASONAL_POLAROID_INPUT_BUCKET = "ai-generation-inputs";

export type SeasonalPolaroidInputPaths = {
  attemptId: string;
  primary: string;
  secondary: string | null;
};

export type SeasonalPolaroidStorage = {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: boolean; cacheControl?: string },
      ): Promise<{ error: { message?: string } | null }>;
      remove(paths: string[]): Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type SeasonalPolaroidUpload = {
  bytes: ArrayBuffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export function seasonalPolaroidInputPaths(jobId: string, attemptId: string): SeasonalPolaroidInputPaths {
  if (!/^[a-f0-9]{64}$/i.test(jobId)) throw new Error("invalid seasonal polaroid job id");
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(attemptId)) throw new Error("invalid seasonal polaroid attempt id");
  const prefix = `seasonal-polaroid/${jobId.toLowerCase()}/inputs/${attemptId}`;
  return { attemptId, primary: `${prefix}/primary.input`, secondary: `${prefix}/secondary.input` };
}

export function createSeasonalPolaroidInputAttempt(jobId: string): SeasonalPolaroidInputPaths {
  return seasonalPolaroidInputPaths(jobId, randomUUID());
}

export async function uploadSeasonalPolaroidInputs(args: {
  storage: SeasonalPolaroidStorage;
  jobId: string;
  attemptId: string;
  primary: SeasonalPolaroidUpload;
  secondary?: SeasonalPolaroidUpload;
}): Promise<{ ok: true; paths: SeasonalPolaroidInputPaths } | { ok: false; code: "storage_upload_failed" }> {
  const allocatedPaths = seasonalPolaroidInputPaths(args.jobId, args.attemptId);
  // The secondary key is an optional reference, not an allocated object. Keep
  // it null for one-photo jobs so the worker cannot mistake an unused key for
  // an attached photo and download it on every retry.
  const paths: SeasonalPolaroidInputPaths = {
    ...allocatedPaths,
    secondary: args.secondary ? allocatedPaths.secondary : null,
  };
  const bucket = args.storage.storage.from(SEASONAL_POLAROID_INPUT_BUCKET);
  const cleanupAfterFailure = async () => {
    try {
      await bucket.remove([paths.primary, paths.secondary].filter((path): path is string => Boolean(path)));
    } catch {
      // Cleanup is best effort. The attempt-scoped paths ensure this cleanup
      // cannot remove another admission attempt's objects.
    }
  };

  let primary: { error: { message?: string } | null };
  try {
    primary = await bucket.upload(paths.primary, args.primary.bytes, {
      contentType: args.primary.contentType,
      upsert: false,
      cacheControl: "3600",
    });
  } catch {
    await cleanupAfterFailure();
    return { ok: false, code: "storage_upload_failed" };
  }
  if (primary.error) {
    await cleanupAfterFailure();
    return { ok: false, code: "storage_upload_failed" };
  }
  if (args.secondary) {
    let secondary: { error: { message?: string } | null };
    try {
      secondary = await bucket.upload(paths.secondary!, args.secondary.bytes, {
        contentType: args.secondary.contentType,
        upsert: false,
        cacheControl: "3600",
      });
    } catch {
      await cleanupAfterFailure();
      return { ok: false, code: "storage_upload_failed" };
    }
    if (secondary.error) {
      await cleanupAfterFailure();
      return { ok: false, code: "storage_upload_failed" };
    }
  }

  return { ok: true, paths };
}

export async function cleanupSeasonalPolaroidInputs(
  storage: SeasonalPolaroidStorage,
  paths: SeasonalPolaroidInputPaths,
): Promise<boolean> {
  const existing = [paths.primary, paths.secondary].filter((path): path is string => Boolean(path));
  if (!existing.length) return true;
  try {
    const { error } = await storage.storage.from(SEASONAL_POLAROID_INPUT_BUCKET).remove(existing);
    return !error;
  } catch {
    return false;
  }
}
