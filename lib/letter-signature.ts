import type { Locale } from "./i18n.ts";

export function formatLetterCreationDate(createdAt: string | null | undefined, locale: Locale): string {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function letterSignatureName(savedPetName: string | null | undefined): string {
  return savedPetName?.trim() ?? "";
}
