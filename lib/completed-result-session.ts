import type { GeneratedLetterStructure } from "./generated-letter.ts";
import type { Locale } from "./i18n.ts";
import { isLetterMode, type LetterMode } from "./letter-mode.ts";
import type { PetIntroProfile } from "./pet-profile.ts";
import { parseServiceChannel, type ServiceChannel } from "./service-channel.ts";

export const COMPLETED_RESULT_VERSION = 1;

export type SessionGeneratedResult = {
  personalityType: string;
  personalitySummary: string;
  personalityTags: string[];
  letter: string;
  letterStructure?: GeneratedLetterStructure;
  heroImageUrl: string | null;
  heroImageSkipped?: boolean;
  savedPetName?: string;
  letterId?: string | null;
  petId?: string | null;
  persistenceFailed?: boolean;
  generationLocale?: Locale;
  generationCacheKey?: string;
};

export type CompletedResultSession = {
  version: typeof COMPLETED_RESULT_VERSION;
  mode: LetterMode;
  channel: ServiceChannel | null;
  resultLocale: Locale;
  petIntro: PetIntroProfile;
  memoryAnswers: string[];
  result: SessionGeneratedResult;
};

export function completedResultKey(
  mode: LetterMode,
  channel: ServiceChannel | null | undefined,
): string {
  return `soul-trace-result:v1:${mode}:${channel ?? "direct"}`;
}

function isLocale(value: unknown): value is Locale {
  return value === "ko" || value === "en";
}

function isPetIntro(value: unknown): value is PetIntroProfile {
  if (!value || typeof value !== "object") return false;
  const profile = value as Record<string, unknown>;
  return (
    ["petName", "petNickname", "yearMet", "yearParted", "letterRecipientDetail"].every(
      (key) => typeof profile[key] === "string",
    ) &&
    ["", "dog", "cat", "rabbit", "hamster", "bird", "other"].includes(profile.petType as string) &&
    ["", "mom", "dad", "both", "sister", "brother", "byName", "sibling", "custom"].includes(
      profile.letterRecipient as string,
    ) &&
    (profile.petBreed === undefined || typeof profile.petBreed === "string") &&
    (profile.petAge === undefined || typeof profile.petAge === "string")
  );
}

function isLetterStructure(value: unknown): value is GeneratedLetterStructure {
  if (!value || typeof value !== "object") return false;
  const structure = value as Record<string, unknown>;
  return (
    typeof structure.title === "string" &&
    Array.isArray(structure.paragraphs) &&
    structure.paragraphs.every((paragraph) => typeof paragraph === "string") &&
    typeof structure.endingPhrase === "string"
  );
}

function isGeneratedResult(value: unknown): value is SessionGeneratedResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.personalityType === "string" &&
    typeof result.personalitySummary === "string" &&
    Array.isArray(result.personalityTags) &&
    result.personalityTags.every((tag) => typeof tag === "string") &&
    typeof result.letter === "string" &&
    result.letter.length > 0 &&
    (result.letterStructure === undefined || isLetterStructure(result.letterStructure)) &&
    (result.heroImageUrl === null || typeof result.heroImageUrl === "string") &&
    (result.heroImageSkipped === undefined || typeof result.heroImageSkipped === "boolean") &&
    (result.savedPetName === undefined || typeof result.savedPetName === "string") &&
    (result.letterId === undefined || result.letterId === null || typeof result.letterId === "string") &&
    (result.petId === undefined || result.petId === null || typeof result.petId === "string") &&
    (result.persistenceFailed === undefined || typeof result.persistenceFailed === "boolean") &&
    (result.generationLocale === undefined || isLocale(result.generationLocale)) &&
    (result.generationCacheKey === undefined || typeof result.generationCacheKey === "string")
  );
}

export function parseCompletedResult(
  serialized: string | null,
  expectedMode: LetterMode,
  expectedChannel: ServiceChannel | null | undefined,
): CompletedResultSession | null {
  if (!serialized) return null;
  try {
    const value = JSON.parse(serialized) as Record<string, unknown>;
    const channel = value.channel === null ? null : parseServiceChannel(value.channel);
    if (
      value.version !== COMPLETED_RESULT_VERSION ||
      !isLetterMode(value.mode) ||
      value.mode !== expectedMode ||
      (value.channel !== null && channel === null) ||
      channel !== (expectedChannel ?? null) ||
      !isLocale(value.resultLocale) ||
      !isPetIntro(value.petIntro) ||
      !Array.isArray(value.memoryAnswers) ||
      value.memoryAnswers.length > 20 ||
      !value.memoryAnswers.every((answer) => typeof answer === "string") ||
      !isGeneratedResult(value.result)
    ) return null;
    return value as CompletedResultSession;
  } catch {
    return null;
  }
}
