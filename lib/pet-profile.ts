import type { LetterMode } from "@/lib/letter-mode";
import type { LetterTonePrefs } from "@/lib/survey";

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
  mode: LetterMode,
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
      years !== null
        ? mode === "living"
          ? `함께한 시간: ${profile.yearMet}년부터 지금까지 (${years}년째, 여전히 함께 있다)`
          : `함께한 시간: ${profile.yearMet}년 ~ ${profile.yearParted}년 (${years}년)`
        : "",
      `편지 받는 사람: ${recipientLine}`,
      profile.petType === "cat"
        ? "종 분기: 고양이 — 산책·목줄 같은 개 전용 표현 쓰지 마."
        : profile.petType === "dog"
          ? "종 분기: 강아지 — 산책·목줄 등 자연스러운 표현 가능."
          : profile.petType
            ? `종 분기: ${typeLabels[profile.petType]}에 맞는 일상 어휘만.`
            : "",
      "편지 호칭(엄격): 상대는 '" + resolveRecipientAddress(profile, "ko") + "'(으)로만 부른다. '너'·'너희' 금지.",
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
      ? mode === "living"
        ? `Years together: ${profile.yearMet} to now (${years} years and counting—they are still here)`
        : `Years together: ${profile.yearMet} – ${profile.yearParted} (${years} years)`
      : "",
    `Letter recipient: ${recipientLine}`,
    profile.petType === "cat"
      ? "Species note: cat — avoid dog-only words like leash walks."
      : profile.petType === "dog"
        ? "Species note: dog — walks and leash vocabulary OK."
        : profile.petType
          ? `Species note: match everyday vocabulary to ${typeLabels[profile.petType]}.`
          : "",
    "Addressing (strict): call them \"" +
      resolveRecipientAddress(profile, "en") +
      "\" only—never generic \"you\".",
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
    both: "엄마, 아빠",
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

/** 편지 속에서 상대를 부를 호칭 — '너' 대신 이걸 쓴다 */
export function resolveRecipientAddress(
  profile: PetIntroProfile,
  locale: "ko" | "en",
): string {
  if (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") {
    return profile.letterRecipientDetail.trim();
  }
  if (profile.letterRecipient && profile.letterRecipient in RECIPIENT_LABELS[locale]) {
    const key = profile.letterRecipient as keyof (typeof RECIPIENT_LABELS)["ko"];
    if (key === "byName" || key === "custom") return profile.letterRecipientDetail.trim();
    return RECIPIENT_LABELS[locale][key];
  }
  return locale === "ko" ? "엄마" : "Mom";
}

/** 편지 본문 인칭·호칭·마무리 문장 규칙 */
export function buildLetterAddressingBlock(
  locale: "ko" | "en",
  profile: PetIntroProfile,
  mode: LetterMode,
): string {
  const name = letterPetName(profile);
  const recipient = resolveRecipientAddress(profile, locale);
  const nameLit = JSON.stringify(name);
  const recipientLit = JSON.stringify(recipient);

  if (locale === "ko") {
    const openingRule =
      profile.letterRecipient === "both"
        ? `첫 문장은 반드시 '엄마, 아빠, 나 ${name}야.' 또는 '엄마, 아빠, 나 ${name}이야.' 로 시작한다.`
        : profile.letterRecipient === "sibling"
          ? `첫 문장은 누나·언니·형·오빠 중 설문에 맞는 하나를 골라 '[호칭], 나 ${name}야.' 로 시작한다.`
          : `첫 문장은 반드시 '${recipient}, 나 ${name}야.' 또는 '${recipient}, 나 ${name}이야.' 로 시작한다.`;
    return [
      "[편지 호칭 — 가장 중요]",
      `편지는 **${name}**(애칭)이 **${recipient}**에게 직접 쓰는 1인칭 손편지다.`,
      openingRule,
      `상대를 부를 때: ${recipientLit} 만 쓴다. **'너'·'너희'·'당신' 절대 금지.**`,
      `자기 자신: '나' 또는 이름 ${nameLit}. 상대와 나를 헷갈리지 마.`,
      `문장 예: '엄마, 그때 케이지에서…' / '엄마 손길이 기억나.' — '너 기억나?' 같은 표현 금지.`,
      mode === "living"
        ? `마무리 필수 문장(한 번, 그대로): '오늘도 ${recipient} 옆에서 기다리고 있을게.' ('너를' 쓰지 마)`
        : `마무리 필수 문장(한 번, 그대로): '언제든 빛으로 ${recipient} 곁에 있을게.' ('너를' 쓰지 마)`,
      "톤: AI 산문 금지. **옆에서 말로 하는 대화** — 한 줄에 생각 하나, 설문에 나온 장면만.",
    ].join("\n");
  }

  const openingEn =
    profile.letterRecipient === "both"
      ? `"Hi Mom and Dad, it's me, ${name}."`
      : `"Hi ${recipient}, it's me, ${name}."`;
  return [
    "[Letter addressing — critical]",
    `The pet **${name}** writes in first person **to ${recipient}** only.`,
    `Open with exactly: ${openingEn}`,
    `Address them as ${recipientLit} throughout—never "you" as a distant pronoun; use Mom/Dad/their name like a real letter.`,
    mode === "living"
      ? `Required closing (once, verbatim): "I'll be right here waiting for ${recipient}."`
      : `Required closing (once, verbatim): "I'll always stay close to ${recipient} through the light."`,
    "Tone: spoken conversation, not polished AI prose. One thought per line. Only memories from the survey.",
  ].join("\n");
}

export type PetProfilePayload = {
  petName: string;
  petNickname: string;
  petType: PetType;
  yearMet: number;
  yearParted: number;
  letterRecipient: LetterRecipient;
  letterRecipientDetail: string;
};

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
