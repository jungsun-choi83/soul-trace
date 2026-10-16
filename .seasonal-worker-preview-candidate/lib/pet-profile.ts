import type { LetterMode } from "@/lib/letter-mode";
import type { LetterTonePrefs } from "@/lib/survey";

export type PetType = "dog" | "cat" | "rabbit" | "hamster" | "bird" | "other";
export type PetGender = "male" | "female";

export type LetterRecipient =
  | "mom"
  | "dad"
  | "both"
  | "sister"
  | "brother"
  | "byName"
  // Legacy values remain readable for previously stored records.
  | "sibling"
  | "custom";

export type SelectableLetterRecipient = Exclude<LetterRecipient, "sibling" | "custom">;

export type PetIntroProfile = {
  petName: string;
  petNickname: string;
  petGender: PetGender | "";
  petType: PetType | "";
  petBreed?: string;
  petAge?: string;
  yearMet: string;
  yearParted: string;
  letterRecipient: LetterRecipient | "";
  letterRecipientDetail: string;
};

/**
 * Resolve the Korean relationship term from the pet's perspective.
 * Only the explicit Sister/Brother relationship values are gendered here;
 * all other or incomplete values intentionally produce no derived title.
 */
export function resolveKoreanOwnerAddress(
  petGender: PetGender | string | null | undefined,
  humanRelationship: LetterRecipient | string | null | undefined,
): string | null {
  const relationship = humanRelationship === "sister" || humanRelationship === "Sister"
    ? "sister"
    : humanRelationship === "brother" || humanRelationship === "Brother"
      ? "brother"
      : null;
  if (!relationship) return null;
  if (petGender !== "male" && petGender !== "female") return null;
  if (petGender === "female") return relationship === "sister" ? "언니" : "오빠";
  return relationship === "sister" ? "누나" : "형";
}

export const EMPTY_PET_INTRO: PetIntroProfile = {
  petName: "",
  petNickname: "",
  petGender: "",
  petType: "",
  petBreed: "",
  petAge: "",
  yearMet: "",
  yearParted: "",
  letterRecipient: "",
  letterRecipientDetail: "",
};

/** 편지·UI 표시용 — 애칭 우선 */
export function letterPetName(profile: Pick<PetIntroProfile, "petName" | "petNickname">): string {
  return profile.petNickname.trim() || profile.petName.trim();
}

export function yearsTogether(profile: Pick<PetIntroProfile, "yearMet" | "yearParted" | "petAge">): number | null {
  if (profile.petAge !== undefined && profile.petAge !== "") {
    if (!/^\d+$/.test(profile.petAge)) return null;
    const age = Number(profile.petAge);
    return Number.isSafeInteger(age) && age >= 0 ? age : null;
  }
  if (!/^\d{4}$/.test(profile.yearMet.trim()) || !/^\d{4}$/.test(profile.yearParted.trim())) {
    return null;
  }
  const met = Number.parseInt(profile.yearMet, 10);
  const parted = Number.parseInt(profile.yearParted, 10);
  const currentYear = new Date().getFullYear();
  if (met < 1980 || parted < 1980 || met > currentYear || parted > currentYear || met > parted) {
    return null;
  }
  return parted - met + 1;
}

export function isPetIntroComplete(profile: PetIntroProfile): boolean {
  if (!profile.petName.trim()) return false;
  if (!profile.petGender) return false;
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
  const genderLabels = PET_GENDER_LABELS[locale];
  const koreanOwnerAddress = resolveKoreanOwnerAddress(profile.petGender, profile.letterRecipient);
  const recipientLabels = RECIPIENT_LABELS[locale];
  const breed = profile.petBreed === "mixed-not-sure"
    ? locale === "ko" ? "믹스 / 잘 모르겠음 (품종을 추측하지 말 것)" : "Mixed / Not Sure (do not infer a breed)"
    : (profile.petBreed ?? "").split("-").filter(Boolean).join(" ");

  const petTypeLine = profile.petType
    ? `${typeLabels[profile.petType]} (${profile.petType})`
    : "";

  let recipientLine = "";
  if (profile.letterRecipient) {
    if (locale === "ko" && (profile.letterRecipient === "sister" || profile.letterRecipient === "brother")) {
      recipientLine = koreanOwnerAddress ?? "";
    } else if (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") {
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
      `성별: ${profile.petGender ? genderLabels[profile.petGender] : ""}`,
      `종류: ${petTypeLine}`,
      `품종: ${breed || "알 수 없음 (품종을 추측하지 말 것)"}`,
      profile.petAge !== undefined && profile.petAge !== ""
        ? `함께한 시간: ${profile.petAge}년`
        : years !== null
        ? mode === "living"
          ? `함께한 시간: ${profile.yearMet}년부터 지금까지 (${years}년째, 여전히 함께 있다)`
          : `함께한 시간: ${profile.yearMet}년 ~ ${profile.yearParted}년 (${years}년)`
        : "",
      `편지 받는 사람: ${recipientLine}`,
      profile.letterRecipient === "sister" || profile.letterRecipient === "brother"
        ? koreanOwnerAddress
          ? `한국어 관계 호칭(반드시 유지): ${koreanOwnerAddress}. 설문에서 정해진 이 호칭을 다른 가족 호칭이나 이름으로 바꾸지 마.`
          : "한국어 관계 호칭을 정할 정보가 부족하다. 언니·오빠·누나·형·엄마·아빠를 추측해 쓰지 말고 이름이나 자연스러운 문장 구조를 사용해."
        : "",
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
    `Gender: ${profile.petGender ? genderLabels[profile.petGender] : ""}`,
    `Species: ${petTypeLine}`,
    `Breed: ${breed || "Not Sure (do not infer a breed)"}`,
    profile.petAge !== undefined && profile.petAge !== ""
      ? `Years together: ${profile.petAge} years`
      : years !== null
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

const PET_GENDER_LABELS = {
  ko: { male: "수컷", female: "암컷" },
  en: { male: "Male", female: "Female" },
} as const;

const RECIPIENT_LABELS = {
  ko: {
    mom: "엄마",
    dad: "아빠",
    both: "엄마, 아빠",
    sister: "누나/언니",
    brother: "형/오빠",
    sibling: "누나/언니/형/오빠",
    byName: "이름으로 부르기",
    custom: "직접 입력",
  },
  en: {
    mom: "Mom",
    dad: "Dad",
    both: "Mom and Dad",
    sister: "Sister",
    brother: "Brother",
    sibling: "Sister / Brother",
    byName: "Call by name",
    custom: "Custom",
  },
} as const;

/** 테스트에서만 쓴다 — 첫 문장이 틀리면 편지 전체가 어색해지므로 따로 검증한다. */
export const __internal = { endsWithFinalConsonant, selfIntroSentence };

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

/**
 * 마지막 글자에 받침이 있는가 — '나 콩이야' 와 '나 콩이이야' 를 가른다.
 *
 * 한글 음절은 0xAC00 부터 (초성×21×28 + 중성×28 + 종성) 으로 배열돼 있어서,
 * 28 로 나눈 나머지가 곧 종성이다. 0 이면 받침이 없다.
 */
function endsWithFinalConsonant(name: string): boolean {
  const last = name.trim().at(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * '나 ○○야' / '나 ○○이야' 중 맞는 하나.
 *
 * 둘 다 후보로 주면 모델이 애칭에 '이' 를 덧붙여 '콩이이야' 를 쓴다.
 * 편지의 첫 문장이라 틀리면 바로 눈에 걸린다.
 */
function selfIntroSentence(name: string): string {
  return endsWithFinalConsonant(name) ? `나 ${name}이야` : `나 ${name}야`;
}

/** 편지 본문 인칭·호칭·마무리 문장 규칙 */
export function buildLetterAddressingBlock(
  locale: "ko" | "en",
  profile: PetIntroProfile,
  mode: LetterMode,
): string {
  const name = letterPetName(profile);
  const koreanOwnerAddress = resolveKoreanOwnerAddress(profile.petGender, profile.letterRecipient);
  const isGenderedKoreanRelationship =
    locale === "ko" && (profile.letterRecipient === "sister" || profile.letterRecipient === "brother");
  const recipient = isGenderedKoreanRelationship
    ? koreanOwnerAddress ?? ""
    : resolveRecipientAddress(profile, locale);
  const nameLit = JSON.stringify(name);
  const recipientLit = JSON.stringify(recipient);

  if (locale === "ko") {
    const selfIntro = selfIntroSentence(name);
    const openingRule =
      profile.letterRecipient === "both"
        ? `첫 1~2줄 안에서 엄마와 아빠에게 자연스럽게 말을 걸고 ${name}의 목소리임을 드러낸다. 고정된 인사 문구를 쓰지 말고 설문 장면과 분위기에 맞춰 매번 다르게 시작한다. 자기소개 문법은 '${selfIntro}' 형태가 자연스럽다.`
        : profile.letterRecipient === "sister" || profile.letterRecipient === "brother"
          ? koreanOwnerAddress
            ? `첫 1~2줄 안에서 저장된 한국어 관계 호칭 ${koreanOwnerAddress}에게 자연스럽게 말을 건다. 이 호칭을 다른 가족 호칭이나 이름으로 바꾸지 않는다. 고정된 자기소개 문장을 쓰지 말고 설문 장면과 분위기에 맞춰 시작한다.`
            : "관계와 반려동물 성별만으로 정할 수 없는 상태다. 언니·오빠·누나·형·엄마·아빠를 추측하지 말고 이름이나 자연스러운 문장 구조로 시작한다."
            : profile.letterRecipient === "sibling"
              ? `첫 1~2줄 안에서 누나·언니·형·오빠 중 저장된 관계에 맞는 호칭으로 자연스럽게 말을 건다. 고정된 자기소개 문장을 쓰지 말고 설문 장면과 분위기에 맞춰 시작한다.`
          : `첫 1~2줄 안에서 ${recipient}에게 자연스럽게 말을 걸고 ${name}의 목소리임을 드러낸다. 고정된 인사 문구를 쓰지 말고 설문 장면과 분위기에 맞춰 매번 다르게 시작한다. 이름에 '이'를 더 붙이지 마.`;
    return [
      "[편지 호칭 — 가장 중요]",
      `편지는 **${name}**(애칭)이 **${recipient}**에게 직접 쓰는 1인칭 손편지다.`,
      openingRule,
      recipient
        ? `첫 줄은 반드시 다음 형식 중 하나를 분위기와 기억에 맞게 골라 자연스럽게 변주한다: "사랑하는 ${recipient}에게,", "소중한 ${recipient}에게,", "나의 소중한 ${recipient}에게,", "${recipient}에게,", "${recipient},". 매번 같은 형식을 고르지 않는다.`
        : "첫 줄은 정해지지 않은 관계 호칭을 추측하지 말고, 이름이나 자연스러운 문장 구조로 시작한다.",
      recipient
        ? `호칭에는 설문에서 구조적으로 선택된 받는 사람 ${recipientLit}만 사용한다. 자유 서술 답변에 나온 관계를 호칭으로 바꾸지 말고, '주인', '마스터', '인간'처럼 제품이 정하지 않은 관계 호칭을 새로 만들지 않는다.`
        : "정해지지 않은 관계 호칭을 새로 만들지 않는다. 자유 서술 답변의 관계를 추측해 호칭으로 바꾸지 말고, '주인', '마스터', '인간'도 만들지 않는다.",
      recipient
        ? `상대를 부를 때: ${recipientLit} 만 쓴다. **'너'·'너희'·'당신' 절대 금지.**`
        : "상대에게 말을 걸 때는 이름이나 자연스러운 문장 구조를 사용한다. **'너'·'너희'·'당신' 절대 금지.**",
      `자기 자신: '나' 또는 이름 ${nameLit}. 상대와 나를 헷갈리지 마.`,
      `문장 예: '엄마, 그때 케이지에서…' / '엄마 손길이 기억나.' — '너 기억나?' 같은 표현 금지.`,
      mode === "living"
        ? `마지막 1~2줄은 설문의 실제 기억·습관·장소 중 하나를 다시 떠올리며 현재나 가까운 미래로 자연스럽게 닫는다. 고정 문구나 '기다리고 있을게'를 반복하지 말고 매 편지 다르게 쓴다.`
        : `마지막 1~2줄은 설문의 실제 기억·습관·장소 중 하나와 이어지게 조용히 닫는다. 고정 문구나 '빛으로 곁에 있을게'를 반복하지 말고 매 편지 다르게 쓴다.`,
      "톤: AI 산문 금지. **옆에서 말로 하는 대화** — 한 줄에 생각 하나, 설문에 나온 장면만.",
    ].join("\n");
  }

  return [
    "[Letter addressing — critical]",
    `The pet **${name}** writes in first person **to ${recipient}** only.`,
    `Begin with one natural salutation chosen to fit the selected mood and supplied memories: "Dear ${recipient},", "To my ${recipient},", "To my beloved ${recipient},", "My dear ${recipient},", "For ${recipient},", or "${recipient},". Vary the choice naturally; do not default to "Hey ${recipient}" or always reuse one form.`,
    `The salutation may use only the product-resolved recipient ${recipientLit}. Never turn a relationship mentioned in a free-text answer into the salutation, and never invent labels such as "Owner", "Master", or "Human". A supported relationship label is allowed only when ${recipientLit} itself is that exact label.`,
    `After the salutation, make ${name}'s identity clear within the first two lines and let the first supplied memory shape the opening rather than using a stock self-introduction.`,
    `Address them as ${recipientLit} throughout—never "you" as a distant pronoun; use Mom/Dad/their name like a real letter.`,
    mode === "living"
      ? `Close in one or two natural lines connected to a specific supplied memory, habit, or place and the present or near future. Vary the wording every time; do not use a stock promise about waiting or staying nearby.`
      : `Close in one or two quiet lines connected to a specific supplied memory, habit, or place. Vary the wording every time; do not use a stock promise about light or always staying nearby.`,
    "Tone: spoken conversation, not polished AI prose. One thought per line. Only memories from the survey.",
  ].join("\n");
}

export type PetProfilePayload = {
  petName: string;
  petNickname: string;
  petGender: PetGender;
  petType: PetType;
  petBreed?: string;
  petAge?: string;
  yearMet: number;
  yearParted: number;
  letterRecipient: LetterRecipient;
  letterRecipientDetail: string;
};

export function buildLetterRequestFields(
  profile: PetIntroProfile,
  tonePrefs: LetterTonePrefs,
): (PetProfilePayload & {
  relationship: LetterRecipient;
  tonePrefs: LetterTonePrefs;
}) | null {
  const payload = petProfilePayloadFromIntro(profile);
  if (!payload) return null;
  if (!tonePrefs.mood || !tonePrefs.length) return null;
  return {
    ...payload,
    relationship: payload.letterRecipient,
    tonePrefs: { ...tonePrefs, options: [] },
  };
}

export function petProfilePayloadFromIntro(profile: PetIntroProfile): PetProfilePayload | null {
  const years = yearsTogether(profile);
  if (!profile.petName.trim() || !profile.petGender || !profile.petType || years === null || !profile.letterRecipient) {
    return null;
  }
  if (
    (profile.letterRecipient === "byName" || profile.letterRecipient === "custom") &&
    !profile.letterRecipientDetail.trim()
  ) {
    return null;
  }
  const currentYear = new Date().getFullYear();
  const compatibilityYearParted = profile.petAge !== undefined && profile.petAge !== ""
    ? currentYear
    : Number.parseInt(profile.yearParted, 10);
  const compatibilityYearMet = profile.petAge !== undefined && profile.petAge !== ""
    ? currentYear - Math.max(years, 1) + 1
    : Number.parseInt(profile.yearMet, 10);
  return {
    petName: profile.petName.trim(),
    petNickname: profile.petNickname.trim(),
    petGender: profile.petGender,
    petType: profile.petType,
    petBreed: profile.petBreed,
    petAge: profile.petAge,
    yearMet: compatibilityYearMet,
    yearParted: compatibilityYearParted,
    letterRecipient: profile.letterRecipient,
    letterRecipientDetail: profile.letterRecipientDetail.trim(),
  };
}
