import type { Messages } from "@/lib/i18n";
// lib 안에서는 상대 경로 + 확장자를 쓴다. `@/` 별칭은 번들러만 알아서,
// node --test / 프롬프트 확인 스크립트가 이 파일을 못 읽는다.
import { modeCopy, type LetterMode } from "./letter-mode.ts";
import {
  isCustomizedServiceChannel,
  type CustomizedServiceChannel,
  type ServiceChannel,
} from "./service-channel.ts";

export const MEMORY_STEP_COUNT = 5;
/**
 * TEMPORARILY FROZEN: keep the pet-photo upload implementation for a later release.
 * Change this to `true` to restore the photo upload, consent, and motion step.
 */
export const PET_PHOTO_UPLOAD_ENABLED = false;
export const PHOTO_STEP_COUNT = PET_PHOTO_UPLOAD_ENABLED ? 1 : 0;
export const TONE_STEP_COUNT = 3;
export const SURVEY_STEP_COUNT = MEMORY_STEP_COUNT + PHOTO_STEP_COUNT + TONE_STEP_COUNT;
/** Q9 — 0-based index 4 */
export const OPTIONAL_MEMORY_STEP = 4;
/** 기억 질문 직후 — 영상용 사진 업로드 */
export const PHOTO_SURVEY_STEP = MEMORY_STEP_COUNT;

export type LetterToneMood = "bright" | "calm" | "warm";
export type LetterToneOption = "comfort" | "no_heaven" | "frequent_name";
export type LetterLength = "short" | "normal";
export type VideoMotion = "breathing" | "ears" | "head_tilt" | "tail";

export type LetterTonePrefs = {
  mood: LetterToneMood | "";
  options: LetterToneOption[];
  length: LetterLength | "";
};

export const EMPTY_TONE_PREFS: LetterTonePrefs = {
  mood: "",
  options: [],
  length: "",
};

export type SurveyAnswer = { id?: string; question: string; answer: string };

export type SurveyQuestion = {
  id?: string;
  promptText: string;
  placeholder: string;
  example?: string;
  optional?: boolean;
  optionalNote?: string;
  skipLabel?: string;
};

export function channelMemoryQuestions(
  messages: Messages,
  channel: ServiceChannel | null | undefined,
): SurveyQuestion[] | null {
  if (!isCustomizedServiceChannel(channel)) return null;
  return messages.survey.channels[channel];
}

export function surveyIntroduction(
  messages: Messages,
  mode: LetterMode,
  channel: ServiceChannel | null | undefined,
): Pick<ReturnType<typeof modeCopy>, "headline" | "subline"> {
  const copy = modeCopy(messages, mode);

  if (mode !== "living" || !isCustomizedServiceChannel(channel)) {
    return { headline: copy.headline, subline: copy.subline };
  }

  return messages.survey.channelIntroductions[channel];
}

export function memoryQuestionCount(channel?: ServiceChannel | null): number {
  return isCustomizedServiceChannel(channel) ? CHANNEL_MEMORY_COUNTS[channel] : MEMORY_STEP_COUNT;
}

export function isChannelMemoryOptional(
  channel: ServiceChannel | null | undefined,
  index: number,
): boolean {
  return Boolean(
    channel &&
      ((channel === "pension" && index === 3) ||
        (channel === "grooming" && index === 4) ||
        (channel === "hospital" && (index === 2 || index === 3))),
  );
}

const CHANNEL_MEMORY_COUNTS: Record<CustomizedServiceChannel, number> = {
  pension: 4,
  grooming: 5,
  hospital: 4,
};

export function formatSurveyName(template: string, name: string): string {
  const trimmed = name.trim();
  return template.replace(/○○/g, trimmed).replace(/%NAME%/g, trimmed);
}

export function buildSurveyAnswers(
  messages: Messages,
  mode: LetterMode,
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  petDisplayName: string,
  channel?: ServiceChannel | null,
): SurveyAnswer[] {
  const copy = modeCopy(messages, mode);
  const memoryItems = channelMemoryQuestions(messages, channel) ?? copy.memory;
  const memory = memoryItems.map((item, index) => ({
    ...(item.id ? { id: item.id } : {}),
    question: formatSurveyName(item.promptText, petDisplayName),
    answer: memoryAnswers[index]?.trim() ?? "",
  }));

  const tone = copy.tone.map((item) => {
    if (item.id === "q10") {
      const label =
        item.options.find((o) => o.id === tonePrefs.mood)?.label ?? tonePrefs.mood;
      return { question: item.promptText, answer: label };
    }
    if (item.id === "q11") {
      const labels = item.options
        .filter((o) => tonePrefs.options.includes(o.id as LetterToneOption))
        .map((o) => o.label);
      return {
        question: item.promptText,
        answer: labels.length > 0 ? labels.join(", ") : messages.survey.toneQ11None,
      };
    }
    const label =
      item.options.find((o) => o.id === tonePrefs.length)?.label ?? tonePrefs.length;
    return { question: item.promptText, answer: label };
  });

  return [...memory, ...tone];
}

export function buildTonePromptBlock(
  locale: "ko" | "en",
  tonePrefs: LetterTonePrefs,
  messages: Messages,
  mode: LetterMode,
): string {
  const tone = modeCopy(messages, mode).tone;
  const moodLabel = tone[0].options.find((o) => o.id === tonePrefs.mood)?.label ?? "";
  const lengthLabel = tone[2].options.find((o) => o.id === tonePrefs.length)?.label ?? "";

  const optionLines = tone[1].options
    .filter((o) => tonePrefs.options.includes(o.id as LetterToneOption))
    .map((o) => `- ${o.label}`);

  if (locale === "ko") {
    return [
      "[편지 톤 — STEP 3]",
      `분위기: ${moodLabel}`,
      `길이: ${lengthLabel}`,
      optionLines.length > 0
        ? `추가 요청:\n${optionLines.join("\n")}`
        : "추가 요청: (없음 — 위로·표현 제한·이름 빈도 기본값)",
      tonePrefs.options.includes("comfort")
        ? mode === "living"
          ? "「괜찮아, 잘하고 있어」 류의 위로를 편지에 자연스럽게 넣어도 좋아."
          : "「네 잘못이 아니야」 류의 위로를 편지에 자연스럽게 넣어도 좋아."
        : "위로 문장을 억지로 넣지 마 — 사용자가 선택하지 않았어.",
      // 살아 있는 갈래에서는 선택지 자체가 없다. 사후 표현은 언제나 금지다.
      mode === "living" || tonePrefs.options.includes("no_heaven")
        ? "하늘·무지개다리·천국 표현은 쓰지 마."
        : "",
      tonePrefs.options.includes("frequent_name")
        ? "아이 이름(애칭)을 편지에서 여러 번 불러줘."
        : "",
      tonePrefs.length === "short"
        ? "편지는 짧고 자연스럽게 쓴다. 내용에 맞춰 길이를 정하고, 핵심 기억과 감정만 남긴다. 정해진 줄 수를 맞추려고 문장을 늘리거나 반복하지 마."
        : "편지는 기억의 양과 감정 흐름에 맞는 자연스러운 길이로 쓴다. 중요한 장면은 충분히 머물되, 정해진 줄 수를 채우려고 반복하거나 새 사실을 만들지 마.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    "[Letter tone — STEP 3]",
    `Mood: ${moodLabel}`,
    `Length: ${lengthLabel}`,
    optionLines.length > 0 ? `Extra requests:\n${optionLines.join("\n")}` : "Extra requests: (none)",
    tonePrefs.options.includes("comfort")
      ? mode === "living"
        ? "If reassurance fits, express it in original wording grounded in a supplied living memory; do not use a stock reassurance phrase."
        : "If reassurance fits, express it in original wording grounded in a supplied memorial memory; do not use a stock reassurance phrase."
      : "Do NOT force reassurance lines—the user did not opt in.",
    // The living branch never offers the option; afterlife language is banned outright.
    mode === "living" || tonePrefs.options.includes("no_heaven")
      ? "Avoid heaven, rainbow bridge, or afterlife clichés."
      : "",
    tonePrefs.options.includes("frequent_name")
      ? "Say the pet's name (nickname) often in the letter."
      : "",
    tonePrefs.length === "short"
      ? "Keep the letter naturally short. Let the available memories determine its length; do not pad, repeat, or target a fixed line count."
      : "Use a natural length shaped by the available memories and emotional flow. Give important scenes room, but do not pad, repeat, target a fixed line count, or invent facts.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isPhotoSurveyStep(step: number): boolean {
  return PET_PHOTO_UPLOAD_ENABLED && step === PHOTO_SURVEY_STEP;
}

export function isPhotoStepValid(hasPhoto: boolean, skipped: boolean, photoConsent: boolean): boolean {
  if (skipped) return true;
  if (hasPhoto) return photoConsent;
  return false;
}

export function isMemoryStepValid(step: number, memoryAnswers: string[]): boolean {
  if (step === OPTIONAL_MEMORY_STEP) return true;
  return (memoryAnswers[step]?.trim().length ?? 0) > 0;
}

export function isToneStepValid(toneIndex: number, tonePrefs: LetterTonePrefs): boolean {
  if (toneIndex === 0) return tonePrefs.mood !== "";
  if (toneIndex === 1) return true;
  if (toneIndex === 2) return tonePrefs.length !== "";
  return false;
}

export function isSurveyStepValid(
  step: number,
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  photoReady: { hasPhoto: boolean; skipped: boolean; photoConsent: boolean },
  channel?: ServiceChannel | null,
): boolean {
  const memoryCount = memoryQuestionCount(channel);
  if (step < memoryCount) {
    if (isChannelMemoryOptional(channel, step)) return true;
    return isMemoryStepValid(step, memoryAnswers);
  }
  if (PET_PHOTO_UPLOAD_ENABLED && step === memoryCount) {
    return isPhotoStepValid(photoReady.hasPhoto, photoReady.skipped, photoReady.photoConsent);
  }
  return isToneStepValid(step - memoryCount - PHOTO_STEP_COUNT, tonePrefs);
}

export function isSurveyComplete(
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  channel?: ServiceChannel | null,
): boolean {
  const memoryCount = memoryQuestionCount(channel);
  for (let i = 0; i < memoryCount; i++) {
    if (
      isChannelMemoryOptional(channel, i) ||
      (!isCustomizedServiceChannel(channel) && i === OPTIONAL_MEMORY_STEP)
    ) continue;
    if (!memoryAnswers[i]?.trim()) return false;
  }
  return tonePrefs.mood !== "" && tonePrefs.length !== "";
}
