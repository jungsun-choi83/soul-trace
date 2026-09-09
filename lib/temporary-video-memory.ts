export const MAX_TEMPORARY_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_TEMPORARY_VIDEO_SECONDS = 30;

export type TemporaryVideoValidationError = "unsupported" | "oversized" | null;

export function validateTemporaryVideoFile(
  file: Pick<File, "type" | "size">,
): TemporaryVideoValidationError {
  if (!file.type.startsWith("video/") || file.size <= 0) return "unsupported";
  if (file.size > MAX_TEMPORARY_VIDEO_BYTES) return "oversized";
  return null;
}
