import type { PetType } from "./pet-profile.ts";

export type DefaultStampType = "dog" | "cat" | "rabbit" | "hamster" | "bird" | "other";
export type StampType = "photo" | `paw_${DefaultStampType}`;

/** Select the species-appropriate fallback stamp without ever throwing. */
export function resolveDefaultStampByPetType(petType: unknown): DefaultStampType {
  if (petType === "dog" || petType === "cat" || petType === "rabbit" || petType === "hamster" || petType === "bird") {
    return petType;
  }
  return "other";
}

export function resolveStampType(petType: PetType | "" | unknown, hasPhoto: boolean): StampType {
  if (hasPhoto) return "photo";
  return `paw_${resolveDefaultStampByPetType(petType)}`;
}

export function isStampType(value: unknown): value is StampType | "paw" {
  return value === "photo" || value === "paw" || (
    typeof value === "string" &&
    ["dog", "cat", "rabbit", "hamster", "bird", "other"].some((type) => value === `paw_${type}`)
  );
}

export function normalizeStampType(value: unknown): StampType {
  if (value === "photo") return "photo";
  if (value === "paw_dog" || value === "paw_cat" || value === "paw_rabbit" || value === "paw_hamster" || value === "paw_bird" || value === "paw_other") {
    return value;
  }
  return "paw_other";
}
