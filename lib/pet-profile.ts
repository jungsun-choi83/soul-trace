export type PetType = "dog" | "cat" | "rabbit" | "hamster" | "bird" | "other";

export type LetterRecipient = "mom" | "dad" | "both" | "sibling" | "byName" | "custom";

export type PetIntroProfile = {
  petName: string;
  petNickname: string;
  petType: PetType | "";
  yearMet: string;
  yearParted: string;
  letterRecipient: LetterRecipient | "";
  letterRecipientDetail: string;
};

export const EMPTY_PET_INTRO: PetIntroProfile = {
  petName: "",
  petNickname: "",
  petType: "",
  yearMet: "",
  yearParted: "",
  letterRecipient: "",
  letterRecipientDetail: "",
};

/** 편지·UI 표시용 — 애칭 우선 */
export function letterPetName(profile: Pick<PetIntroProfile, "petName" | "petNickname">): string {
  return profile.petNickname.trim() || profile.petName.trim();
}

export function yearsTogether(profile: Pick<PetIntroProfile, "yearMet" | "yearParted">): number | null {
  const met = Number.parseInt(profile.yearMet, 10);
  const parted = Number.parseInt(profile.yearParted, 10);
  if (!Number.isFinite(met) || !Number.isFinite(parted) || met > parted) return null;
  return parted - met + 1;
}

export function isPetIntroComplete(profile: PetIntroProfile): boolean {
  if (!profile.petName.trim()) return false;
  if (!profile.petType) return false;
  if (yearsTogether(profile) === null) return false;
  if (!profile.letterRecipient) return false;
  if (
    (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") &&
    !profile.letterRecipientDetail.trim()
  ) {
    return false;
  }
  return true;
}

export function buildPetProfilePromptBlock(
  locale: "ko" | "en",
  profile: PetIntroProfile,
): string {
  const name = letterPetName(profile);
  const formalName = profile.petName.trim();
  const years = yearsTogether(profile);
  const typeLabels = PET_TYPE_LABELS[locale];
  const recipientLabels = RECIPIENT_LABELS[locale];

  const petTypeLine = profile.petType
    ? `${typeLabels[profile.petType]} (${profile.petType})`
    : "";

  let recipientLine = "";
  if (profile.letterRecipient) {
    if (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") {
      recipientLine = `${recipientLabels[profile.letterRecipient]}: ${profile.letterRecipientDetail.trim()}`;
    } else {
      recipientLine = recipientLabels[profile.letterRecipient];
    }
  }

  if (locale === "ko") {
    return [
      "[아이 프로필 — STEP 1]",
      `정식 이름: ${formalName}`,
      `편지 속 호칭(애칭 우선): ${name}`,
      `종류: ${petTypeLine}`,
      years !== null ? `함께한 시간: ${profile.yearMet}년 ~ ${profile.yearParted}년 (${years}년)` : "",
      `편지 받는 사람: ${recipientLine}`,
      profile.petType === "cat"
        ? "종 분기: 고양이 — 산책·목줄 같은 개 전용 표현 쓰지 마."
        : profile.petType === "dog"
          ? "종 분기: 강아지 — 산책·목줄 등 자연스러운 표현 가능."
          : profile.petType
            ? `종 분기: ${typeLabels[profile.petType]}에 맞는 일상 어휘만.`
            : "",
      "편지 호칭(엄격): 위 '편지 받는 사람'에 맞춰 인사·호칭을 끝까지 통일. '너희'와 '너'를 섞지 마.",
      years !== null
        ? `마무리 힌트: ${years}년이라는 시간을 편지 마지막 근처에서 자연스럽게 한 번 언급해도 좋아.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "[Companion profile — STEP 1]",
    `Formal name: ${formalName}`,
    `Name in letter (nickname first): ${name}`,
    `Species: ${petTypeLine}`,
    years !== null
      ? `Years together: ${profile.yearMet} – ${profile.yearParted} (${years} years)`
      : "",
    `Letter recipient: ${recipientLine}`,
    profile.petType === "cat"
      ? "Species note: cat — avoid dog-only words like leash walks."
      : profile.petType === "dog"
        ? "Species note: dog — walks and leash vocabulary OK."
        : profile.petType
          ? `Species note: match everyday vocabulary to ${typeLabels[profile.petType]}.`
          : "",
    "Addressing (strict): match the recipient above throughout—never mix plural and singular.",
    years !== null
      ? `Closing hint: you may naturally mention the ${years} years together near the end.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const PET_TYPE_LABELS = {
  ko: {
    dog: "강아지",
    cat: "고양이",
    rabbit: "토끼",
    hamster: "햄스터",
    bird: "새",
    other: "기타",
  },
  en: {
    dog: "Dog",
    cat: "Cat",
    rabbit: "Rabbit",
    hamster: "Hamster",
    bird: "Bird",
    other: "Other",
  },
} as const;

const RECIPIENT_LABELS = {
  ko: {
    mom: "엄마",
    dad: "아빠",
    both: "엄마랑 아빠",
    sibling: "누나/언니/형/오빠",
    byName: "이름으로 부르기",
    custom: "직접 입력",
  },
  en: {
    mom: "Mom",
    dad: "Dad",
    both: "Mom and Dad",
    sibling: "Sister / Brother",
    byName: "Call by name",
    custom: "Custom",
  },
} as const;

export type PetProfilePayload = {
  petName: string;
  petNickname: string;
  petType: PetType;
  yearMet: number;
  yearParted: number;
  letterRecipient: LetterRecipient;
  letterRecipientDetail: string;
};

import type { LetterTonePrefs } from "@/lib/survey";

export function buildLetterRequestFields(
  profile: PetIntroProfile,
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
): (PetProfilePayload & { preferredScenery: string; tonePrefs: LetterTonePrefs }) | null {
  const payload = petProfilePayloadFromIntro(profile);
  if (!payload) return null;
  if (!tonePrefs.mood || !tonePrefs.length) return null;
  return {
    ...payload,
    preferredScenery: (memoryAnswers[0] ?? "").trim(),
    tonePrefs,
  };
}

export function petProfilePayloadFromIntro(profile: PetIntroProfile): PetProfilePayload | null {
  const years = yearsTogether(profile);
  if (!profile.petName.trim() || !profile.petType || years === null || !profile.letterRecipient) {
    return null;
  }
  if (
    (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") &&
    !profile.letterRecipientDetail.trim()
  ) {
    return null;
  }
  return {
    petName: profile.petName.trim(),
    petNickname: profile.petNickname.trim(),
    petType: profile.petType,
    yearMet: Number.parseInt(profile.yearMet, 10),
    yearParted: Number.parseInt(profile.yearParted, 10),
    letterRecipient: profile.letterRecipient,
    letterRecipientDetail: profile.letterRecipientDetail.trim(),
  };
}
