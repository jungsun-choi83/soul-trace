import { isLetterMode, type LetterMode } from "./letter-mode.ts";
import type { PetIntroProfile } from "./pet-profile.ts";
import { parseServiceChannel, type ServiceChannel } from "./service-channel.ts";
import type { LetterTonePrefs } from "./survey.ts";

export const QUESTIONNAIRE_DRAFT_VERSION = 1;

export type QuestionnaireDraft = {
  version: typeof QUESTIONNAIRE_DRAFT_VERSION;
  mode: LetterMode;
  channel: ServiceChannel | null;
  questionIndex: number;
  petIntro: PetIntroProfile;
  memoryAnswers: string[];
  tonePrefs: LetterTonePrefs;
  petPhotoSkipped: boolean;
  privacyConsent: boolean;
};

export function questionnaireDraftKey(
  mode: LetterMode,
  channel: ServiceChannel | null | undefined,
): string {
  return `soul-trace-draft:v1:${mode}:${channel ?? "direct"}`;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isPetIntro(value: unknown): value is PetIntroProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  const petTypes = ["", "dog", "cat", "rabbit", "hamster", "bird", "other"];
  const recipients = ["", "mom", "dad", "both", "sister", "brother", "byName", "sibling", "custom"];
  return (
    isString(profile.petName) &&
    isString(profile.petNickname) &&
    petTypes.includes(profile.petType as string) &&
    (profile.petBreed === undefined || isString(profile.petBreed)) &&
    (profile.petAge === undefined || isString(profile.petAge)) &&
    isString(profile.yearMet) &&
    isString(profile.yearParted) &&
    recipients.includes(profile.letterRecipient as string) &&
    isString(profile.letterRecipientDetail)
  );
}

function isTonePrefs(value: unknown): value is LetterTonePrefs {
  if (!value || typeof value !== "object") return false;
  const tone = value as Record<string, unknown>;
  return (
    ["", "bright", "calm", "warm"].includes(tone.mood as string) &&
    ["", "short", "normal"].includes(tone.length as string) &&
    Array.isArray(tone.options) &&
    tone.options.every((option) => ["comfort", "no_heaven", "frequent_name"].includes(option))
  );
}

export function parseQuestionnaireDraft(
  serialized: string | null,
  expectedMode: LetterMode,
  expectedChannel: ServiceChannel | null | undefined,
): QuestionnaireDraft | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const channel = value.channel === null ? null : parseServiceChannel(value.channel);
    const normalizedExpectedChannel = expectedChannel ?? null;
    if (
      value.version !== QUESTIONNAIRE_DRAFT_VERSION ||
      !isLetterMode(value.mode) ||
      value.mode !== expectedMode ||
      (value.channel !== null && channel === null) ||
      channel !== normalizedExpectedChannel ||
      !Number.isSafeInteger(value.questionIndex) ||
      (value.questionIndex as number) < 0 ||
      !isPetIntro(value.petIntro) ||
      !Array.isArray(value.memoryAnswers) ||
      value.memoryAnswers.length > 20 ||
      !value.memoryAnswers.every(isString) ||
      !isTonePrefs(value.tonePrefs) ||
      typeof value.petPhotoSkipped !== "boolean" ||
      typeof value.privacyConsent !== "boolean"
    ) {
      return null;
    }
    return value as QuestionnaireDraft;
  } catch {
    return null;
  }
}
