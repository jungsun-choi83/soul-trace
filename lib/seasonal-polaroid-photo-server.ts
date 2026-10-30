import {
  SEASONAL_POLAROID_PHOTO_MAX_BYTES,
  validateSeasonalPolaroidPhoto,
} from "./seasonal-polaroid-photo.ts";
import type { SeasonalPolaroidValidationIssue } from "./seasonal-polaroid-contract.ts";

export type SeasonalPolaroidPhotoFormat = "image/jpeg" | "image/png" | "image/webp";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

/** Detects the actual container instead of trusting a browser-provided MIME type. */
export function detectSeasonalPolaroidPhotoFormat(bytes: Uint8Array): SeasonalPolaroidPhotoFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= PNG_SIGNATURE.length && startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

function looksLikeHeif(bytes: Uint8Array): boolean {
  if (bytes.length < 12 || !startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return false;
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}

function extensionFormat(name: string): SeasonalPolaroidPhotoFormat | "heic" | "unsupported" | null {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (!extension) return null;
  if (extension === "heic" || extension === "heif") return "heic";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (["gif", "bmp", "tif", "tiff", "avif"].includes(extension)) return "unsupported";
  return null;
}

/**
 * Server-side content validation. The normal contract validator checks the
 * request shape; this additional check verifies that bytes agree with the
 * declared MIME type and known extension.
 */
export function validateSeasonalPolaroidPhotoContent(
  file: Pick<File, "name" | "size" | "type">,
  bytes: Uint8Array,
  field: "primaryPhoto",
): SeasonalPolaroidValidationIssue | null {
  const basicError = validateSeasonalPolaroidPhoto(file as File);
  if (basicError === "empty") return { field, code: "photo_empty" };
  if (basicError === "size" || file.size > SEASONAL_POLAROID_PHOTO_MAX_BYTES) {
    return { field, code: "photo_size" };
  }
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return { field, code: "photo_heic" };
  }
  if (looksLikeHeif(bytes)) return { field, code: "photo_heic" };

  const actual = detectSeasonalPolaroidPhotoFormat(bytes);
  if (!actual) return { field, code: "photo_signature" };

  const declared = file.type.trim().toLowerCase();
  if (declared && declared !== actual) return { field, code: "photo_signature" };
  const extension = extensionFormat(file.name);
  if (extension === "heic") return { field, code: "photo_heic" };
  if (extension === "unsupported" || (extension && extension !== actual)) {
    return { field, code: "photo_signature" };
  }
  return null;
}
