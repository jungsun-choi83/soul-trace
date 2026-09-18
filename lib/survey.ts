import type { Messages } from "@/lib/i18n";
// lib 안에서는 상대 경로 + 확장자를 쓴다. `@/` 별칭은 번들러만 알아서,
// node --test / 프롬프트 확인 스크립트가 이 파일을 못 읽는다.
import { modeCopy, type LetterMode } from "./letter-mode.ts";
import {
  isCustomizedServiceChannel,
  type CustomizedServiceChannel,
  type ServiceChannel,
} from "./service-channel.ts";

export const MEMORY_STEP_COUNT = 4;
/**
 * TEMPORARILY FROZEN: keep the pet-photo upload implementation for a later release.
 * Change this to `true` to restore the photo upload, consent, and motion step.
 */
export const PET_PHOTO_UPLOAD_ENABLED = true;
export const PHOTO_STEP_COUNT = PET_PHOTO_UPLOAD_ENABLED ? 1 : 0;
export const TONE_STEP_COUNT = 2;
export const SURVEY_STEP_COUNT = MEMORY_STEP_COUNT + PHOTO_STEP_COUNT + TONE_STEP_COUNT;
/** Final default memory question — 0-based index 3 */
export const OPTIONAL_MEMORY_STEP = 3;
/** 기억 질문과 편지 스타일 질문 직후 — 영상용 사진 업로드 */
export const PHOTO_SURVEY_STEP = MEMORY_STEP_COUNT + TONE_STEP_COUNT;

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

export function activeMemoryQuestions(
  messages: Messages,
  mode: LetterMode,
  channel?: ServiceChannel | null,
): SurveyQuestion[] {
  return channelMemoryQuestions(messages, channel) ?? modeCopy(messages, mode).memory;
}

export function isMemoryQuestionRequired(question: SurveyQuestion | undefined): boolean {
  return question?.optional !== true;
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

export function memoryQuestionCount(
  channel?: ServiceChannel | null,
  mode: LetterMode = "memorial",
): number {
  if (isCustomizedServiceChannel(channel)) return CHANNEL_MEMORY_COUNTS[channel];
  return mode === "living" ? 3 : MEMORY_STEP_COUNT;
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
    const label =
      item.options.find((o) => o.id === tonePrefs.length)?.label ?? tonePrefs.length;
    return { question: item.promptText, answer: label };
  });

  return [...memory, ...tone];
}

const TONE_STYLE_GUIDANCE: Record<"ko" | "en", Record<LetterToneMood, string>> = {
  en: {
    bright: [
      "- Use lively, conversational rhythm.",
      "- Slightly shorter and more energetic sentences are allowed.",
      "- Occasional exclamation marks are okay when natural.",
      "- Playfulness must come only from supplied behavior or memories.",
      "- Do not invent jokes, antics, excitement, motives, or events.",
    ].join("\n"),
    calm: [
      "- Use restrained, quiet phrasing.",
      "- Prefer steady pacing and fewer exclamation marks.",
      "- Keep emotional expression understated.",
      "- Do not make the letter sad simply because the tone is calm.",
      "- Do not add new facts or feelings.",
    ].join("\n"),
    warm: [
      "- Use gentle, reassuring wording and soft transitions.",
      "- Let supplied moments of closeness carry the warmth.",
      "- Do not invent love, longing, comfort, grief, or affection unless supported by the guardian's answers.",
      "- Avoid exaggerated sentimentality.",
    ].join("\n"),
  },
  ko: {
    bright: [
      "- 밝고 자연스러운 말투와 조금 더 경쾌한 리듬을 쓴다.",
      "- 필요할 때만 자연스럽게 느낌표를 사용할 수 있다.",
      "- 장난스러움은 설문에 실제로 나온 행동과 장면에서만 가져온다.",
      "- 새로운 장난, 행동, 신남, 이유를 만들어내지 않는다.",
    ].join("\n"),
    calm: [
      "- 담담하고 차분한 문장과 안정적인 호흡을 쓴다.",
      "- 느낌표를 줄이고 과장하지 않는다.",
      "- 감정 표현은 절제한다.",
      "- 차분한 톤이라고 해서 슬픔을 새로 만들지 않는다.",
      "- 새로운 사실이나 감정을 추가하지 않는다.",
    ].join("\n"),
    warm: [
      "- 부드럽고 따뜻한 어휘와 자연스러운 연결을 사용한다.",
      "- 설문에 나온 함께한 장면에서 따뜻함이 느껴지게 한다.",
      "- 설문에 없는 사랑, 그리움, 위로, 슬픔, 애정을 새로 만들지 않는다.",
      "- 지나치게 감상적이거나 과장된 표현을 피한다.",
    ].join("\n"),
  },
};

export function buildTonePromptBlock(
  locale: "ko" | "en",
  tonePrefs: LetterTonePrefs,
  messages: Messages,
  mode: LetterMode,
): string {
  const tone = modeCopy(messages, mode).tone;
  const moodLabel = tone.find((item) => item.id === "q10")?.options.find((o) => o.id === tonePrefs.mood)?.label ?? "";
  const lengthLabel = tone.find((item) => item.id === "q12")?.options.find((o) => o.id === tonePrefs.length)?.label ?? "";
  const moodGuidance = tonePrefs.mood ? TONE_STYLE_GUIDANCE[locale][tonePrefs.mood] : "";

  if (locale === "ko") {
    return [
      "[편지 톤 — STEP 3]",
      `분위기: ${moodLabel}`,
      "표현 지침:",
      moodGuidance,
      "톤은 제공된 사실을 표현하는 방식만 바꾼다. 실제로 일어난 내용은 절대 바꾸지 마.",
      `길이: ${lengthLabel}`,
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
    "Style guidance:",
    moodGuidance,
    "Tone controls HOW supplied facts are expressed. It must never change WHAT happened.",
    `Length: ${lengthLabel}`,
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
  if (skipped || !hasPhoto) return true;
  if (hasPhoto) return photoConsent;
  return false;
}

export function isMemoryStepValid(
  step: number,
  memoryAnswers: string[],
  memoryQuestions: SurveyQuestion[],
): boolean {
  if (!isMemoryQuestionRequired(memoryQuestions[step])) return true;
  return (memoryAnswers[step]?.trim().length ?? 0) > 0;
}

export function isToneStepValid(toneIndex: number, tonePrefs: LetterTonePrefs): boolean {
  if (toneIndex === 0) return tonePrefs.mood !== "";
  if (toneIndex === 1) return tonePrefs.length !== "";
  return false;
}

export function isSurveyStepValid(
  step: number,
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  photoReady: { hasPhoto: boolean; skipped: boolean; photoConsent: boolean },
  messages: Messages,
  mode: LetterMode,
  channel?: ServiceChannel | null,
): boolean {
  const memoryCount = memoryQuestionCount(channel, mode);
  if (step < memoryCount) {
    return isMemoryStepValid(step, memoryAnswers, activeMemoryQuestions(messages, mode, channel));
  }
  if (PET_PHOTO_UPLOAD_ENABLED && step === memoryCount + TONE_STEP_COUNT) {
    return isPhotoStepValid(photoReady.hasPhoto, photoReady.skipped, photoReady.photoConsent);
  }
  const toneIndex = step - memoryCount;
  return isToneStepValid(toneIndex, tonePrefs);
}

export function isSurveyComplete(
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  messages: Messages,
  mode: LetterMode,
  channel?: ServiceChannel | null,
): boolean {
  const questions = activeMemoryQuestions(messages, mode, channel);
  for (let i = 0; i < questions.length; i++) {
    if (!isMemoryQuestionRequired(questions[i])) continue;
    if (!memoryAnswers[i]?.trim()) return false;
  }
  return tonePrefs.mood !== "" && tonePrefs.length !== "";
}
