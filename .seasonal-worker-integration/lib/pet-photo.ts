/** 영상 생성용 반려 사진 — 클라이언트 검증 (업로드 API는 추후 개발자 연동) */

export const PET_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export const PET_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

const PET_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type PetPhotoValidationError = "type" | "size" | "empty";

export function validatePetPhotoFile(file: File): PetPhotoValidationError | null {
  if (!file.size) return "empty";
  if (file.size > PET_PHOTO_MAX_BYTES) return "size";
  const mime = file.type.toLowerCase();
  if (mime && !PET_PHOTO_MIME.has(mime)) return "type";
  if (!mime && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) return "type";
  return null;
}
