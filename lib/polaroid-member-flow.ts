import { TRIAL_THEMES, type TrialThemeId } from "@/components/trial-theme-scene";
import { FREE_STYLES, type FreeStyle } from "@/lib/pet-free-trial";
import type { PolaroidOccasionGroup, PolaroidOccasionItem } from "@/lib/polaroid-theme-catalog";

/** Signed-in polaroid art styles match the home free trial. */
export const MEMBER_POLAROID_ART_STYLES = FREE_STYLES;

export type MemberPolaroidArtStyle = FreeStyle;

export const MEMBER_ADOPTION_OCCASION_ID = "adoption-day" as const;

/** Free-trial special days, plus adoption day only. */
export const MEMBER_POLAROID_OCCASION_IDS = [
  ...TRIAL_THEMES.map((item) => item.id),
  MEMBER_ADOPTION_OCCASION_ID,
] as const;

export type MemberPolaroidOccasionId = (typeof MEMBER_POLAROID_OCCASION_IDS)[number];

const ADOPTION_OCCASION: PolaroidOccasionItem = {
  id: MEMBER_ADOPTION_OCCASION_ID,
  titleKo: "우리가 처음 만난 날 — 입양 기념일",
  titleEn: "The Day We First Met — Adoption Day",
  hintKo: "우리가 처음 만난 그날의 온기",
  hintEn: "The warmth of the day we first met",
  implemented: true,
};

export const MEMBER_POLAROID_OCCASION_GROUPS: readonly PolaroidOccasionGroup[] = [
  {
    id: "special-days",
    titleKo: "특별한 날",
    titleEn: "Special days",
    items: [
      ...TRIAL_THEMES.map((item) => ({
        id: item.id,
        titleKo: item.ko,
        titleEn: item.en,
        hintKo: item.ko,
        hintEn: item.en,
        implemented: true,
      })),
      ADOPTION_OCCASION,
    ],
  },
];

export function isMemberPolaroidArtStyle(value: string): value is MemberPolaroidArtStyle {
  return (MEMBER_POLAROID_ART_STYLES as readonly string[]).includes(value);
}

export function isMemberPolaroidOccasion(value: string): value is MemberPolaroidOccasionId {
  return (MEMBER_POLAROID_OCCASION_IDS as readonly string[]).includes(value);
}

export function isMemberTrialThemeOccasion(value: string): value is TrialThemeId {
  return TRIAL_THEMES.some((item) => item.id === value);
}

export function memberPolaroidUsesTrialPlate(occasionId: string): occasionId is TrialThemeId {
  return isMemberTrialThemeOccasion(occasionId);
}
