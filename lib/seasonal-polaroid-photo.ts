export const SEASONAL_POLAROID_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const SEASONAL_POLAROID_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type SeasonalPolaroidPhotoError = "type" | "size" | "empty";

/**
 * Browser-only Phase 2 validation. HEIC/HEIF is deliberately rejected because
 * this project has no client-side decoder/converter installed yet.
 */
export function validateSeasonalPolaroidPhoto(file: File): SeasonalPolaroidPhotoError | null {
  if (!file.size) return "empty";
  if (file.size > SEASONAL_POLAROID_PHOTO_MAX_BYTES) return "size";
  const mime = file.type.toLowerCase();
  if (mime && !SUPPORTED_MIME_TYPES.has(mime)) return "type";
  if (!mime && !/\.(jpe?g|png|webp)$/i.test(file.name)) return "type";
  return null;
}
