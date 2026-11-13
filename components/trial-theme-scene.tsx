import type { FreeStyle } from "@/lib/pet-free-trial";

export const TRIAL_THEMES = [
  { id: "christmas-village", ko: "크리스마스 빌리지", en: "Christmas village" },
  { id: "spring-picnic", ko: "봄 피크닉", en: "Spring picnic" },
  { id: "summer-beach", ko: "여름 해변 리조트", en: "Summer beach resort" },
  { id: "autumn-walk", ko: "가을 산책길", en: "Autumn walk" },
  { id: "birthday-room", ko: "생일 파티 룸", en: "Birthday party room" },
  { id: "first-snow-street", ko: "첫눈 오는 거리", en: "First-snow street" },
] as const;

export type TrialThemeId = (typeof TRIAL_THEMES)[number]["id"];

/** Supplied Christmas plates, one file per art style. */
export const CHRISTMAS_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/christmas-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/christmas-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/christmas-pastel.jpg",
};

export const PICNIC_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/picnic-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/picnic-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/picnic-pastel.jpg",
};

export const SUMMER_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/summer-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/summer-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/summer-pastel.jpg",
};

export const AUTUMN_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/autumn-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/autumn-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/autumn-pastel.jpg",
};

export const BIRTHDAY_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/birthday-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/birthday-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/birthday-pastel.jpg",
};

export const SNOW_PLATE_SRC: Record<FreeStyle, string> = {
  "gouache-story": "/images/polaroid/themes/snow-gouache.jpg",
  "felt-doll": "/images/polaroid/themes/snow-felt.jpg",
  "crayon-diary": "/images/polaroid/themes/snow-pastel.jpg",
};

export const STYLE_ORDER: FreeStyle[] = ["gouache-story", "felt-doll", "crayon-diary"];

export function trialPlateSrc(style: FreeStyle, theme: TrialThemeId): string | null {
  if (theme === "christmas-village") return CHRISTMAS_PLATE_SRC[style];
  if (theme === "spring-picnic") return PICNIC_PLATE_SRC[style];
  if (theme === "summer-beach") return SUMMER_PLATE_SRC[style];
  if (theme === "autumn-walk") return AUTUMN_PLATE_SRC[style];
  if (theme === "birthday-room") return BIRTHDAY_PLATE_SRC[style];
  if (theme === "first-snow-street") return SNOW_PLATE_SRC[style];
  return null;
}
