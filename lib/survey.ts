import type { Messages } from "@/lib/i18n";

export const MEMORY_STEP_COUNT = 5;
export const PHOTO_STEP_COUNT = 1;
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

export type SurveyAnswer = { question: string; answer: string };

export function formatSurveyName(template: string, name: string): string {
  const trimmed = name.trim();
  return template.replace(/○○/g, trimmed).replace(/%NAME%/g, trimmed);
}

export function buildSurveyAnswers(
  messages: Messages,
  memoryAnswers: string[],
  tonePrefs: LetterTonePrefs,
  petDisplayName: string,
): SurveyAnswer[] {
  const memory = messages.survey.memory.map((item, index) => ({
    question: formatSurveyName(item.promptText, petDisplayName),
    answer: memoryAnswers[index]?.trim() ?? "",
  }));

  const tone = messages.survey.tone.map((item) => {
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
): string {
  const moodLabel =
    messages.survey.tone[0].options.find((o) => o.id === tonePrefs.mood)?.label ?? "";
  const lengthLabel =
    messages.survey.tone[2].options.find((o) => o.id === tonePrefs.length)?.label ?? "";

  const optionLines = messages.survey.tone[1].options
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
        ? "「네 잘못이 아니야」 류의 위로를 편지에 자연스럽게 넣어도 좋아."
        : "「네 잘못이 아니야」 류의 위로 문장은 넣지 마 — 사용자가 선택하지 않았어.",
      tonePrefs.options.includes("no_heaven")
        ? "하늘·무지개다리·천국 표현은 쓰지 마."
        : "",
      tonePrefs.options.includes("frequent_name")
        ? "아이 이름(애칭)을 편지에서 여러 번 불러줘."
        : "",
      tonePrefs.length === "short"
        ? "편지는 짧게 — 대략 5줄 내외."
        : "편지는 보통 — 대략 10줄 내외.",
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
      ? 'Include gentle reassurance like "it wasn\'t your fault" if it fits.'
      : 'Do NOT include "it wasn\'t your fault" style lines—the user did not opt in.',
    tonePrefs.options.includes("no_heaven") ? "Avoid heaven, rainbow bridge, or afterlife clichés." : "",
    tonePrefs.options.includes("frequent_name")
      ? "Say the pet's name (nickname) often in the letter."
      : "",
    tonePrefs.length === "short" ? "Keep the letter short—about 5 lines." : "Aim for about 10 lines.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function isPhotoSurveyStep(step: number): boolean {
  return step === PHOTO_SURVEY_STEP;
}

function toneSurveyIndex(step: number): number {
  return step - MEMORY_STEP_COUNT - PHOTO_STEP_COUNT;
}

export function isPhotoStepValid(hasPhoto: boolean, skipped: boolean): boolean {
  return hasPhoto || skipped;
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
  photoReady: { hasPhoto: boolean; skipped: boolean },
): boolean {
  if (step < MEMORY_STEP_COUNT) return isMemoryStepValid(step, memoryAnswers);
  if (isPhotoSurveyStep(step)) return isPhotoStepValid(photoReady.hasPhoto, photoReady.skipped);
  return isToneStepValid(toneSurveyIndex(step), tonePrefs);
}

export function isSurveyComplete(memoryAnswers: string[], tonePrefs: LetterTonePrefs): boolean {
  for (let i = 0; i < MEMORY_STEP_COUNT; i++) {
    if (i === OPTIONAL_MEMORY_STEP) continue;
    if (!memoryAnswers[i]?.trim()) return false;
  }
  return tonePrefs.mood !== "" && tonePrefs.length !== "";
}
