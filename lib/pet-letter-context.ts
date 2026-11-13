import type { PetType, PetIntroProfile } from "./pet-profile.ts";
import { EMPTY_PET_INTRO } from "./pet-profile.ts";

export type PetLetterContext = {
  petId: string;
  petName: string;
  lifeStatus: "living" | "memorial" | "unspecified";
  species: string | null;
  birthday: string | null;
  adoptedOn: string | null;
  traits: string | null;
};

const LETTER_MODES = ["living", "memorial"] as const;

/** Validate the private pet-profile endpoint response and bind it to the requested pet. */
export function petLetterContextFromPayload(
  value: unknown,
  expectedPetId: string,
): PetLetterContext | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  if (payload.petId !== expectedPetId || typeof payload.petName !== "string") return null;
  if (payload.lifeStatus !== "unspecified" && !LETTER_MODES.includes(payload.lifeStatus as "living" | "memorial")) {
    return null;
  }
  const nullableStrings = ["species", "birthday", "adoptedOn", "traits"] as const;
  if (nullableStrings.some((key) => payload[key] !== null && typeof payload[key] !== "string")) return null;
  return {
    petId: expectedPetId,
    petName: payload.petName,
    lifeStatus: payload.lifeStatus as PetLetterContext["lifeStatus"],
    species: payload.species as string | null,
    birthday: payload.birthday as string | null,
    adoptedOn: payload.adoptedOn as string | null,
    traits: payload.traits as string | null,
  };
}

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];

export function petTypeFromSpecies(species: string | null | undefined): PetType | "" {
  const normalized = species?.trim().toLocaleLowerCase().replace(/[\s_-]+/g, "") ?? "";
  if (normalized === "dog" || normalized === "canine") return "dog";
  if (normalized === "cat" || normalized === "feline") return "cat";
  if (normalized === "rabbit" || normalized === "bunny") return "rabbit";
  if (normalized === "hamster") return "hamster";
  if (normalized === "bird" || normalized === "avian") return "bird";
  if (normalized && !PET_TYPES.includes(normalized as PetType)) return "other";
  return normalized as PetType | "";
}

export function petIntroFromContext(
  context: PetLetterContext | null | undefined,
  mode: "living" | "memorial",
): PetIntroProfile {
  return {
    ...EMPTY_PET_INTRO,
    ...(context ? {
      petName: context.petName,
      petType: petTypeFromSpecies(context.species),
      yearMet: yearFromDate(context.adoptedOn),
    } : {}),
    yearParted: mode === "living" ? String(new Date().getFullYear()) : "",
  };
}

/** Fill only compatible, still-empty questionnaire fields; never update the saved pet. */
export function mergePetIntroFromContext(
  current: PetIntroProfile,
  context: PetLetterContext,
  mode: "living" | "memorial",
  protectedFields: ReadonlySet<keyof PetIntroProfile> = new Set(),
): PetIntroProfile {
  const prefill = petIntroFromContext(context, mode);
  const next = { ...current };
  if (!protectedFields.has("petName") && !current.petName.trim() && !current.petNickname.trim()) {
    next.petName = prefill.petName;
  }
  if (!protectedFields.has("petType") && !current.petType) next.petType = prefill.petType;
  if (!protectedFields.has("yearMet") && !current.yearMet.trim()) next.yearMet = prefill.yearMet;
  return next;
}

export function petLetterModeFromContext(
  context: PetLetterContext,
): "living" | "memorial" | null {
  return context.lifeStatus === "living" || context.lifeStatus === "memorial"
    ? context.lifeStatus
    : null;
}

function yearFromDate(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? ""
    : value.slice(0, 4);
}

export function isKnownPetIntroQuestion(
  questionId: string,
  context: PetLetterContext | null | undefined,
): boolean {
  if (!context) return false;
  if (questionId === "name") return Boolean(context.petName.trim());
  if (questionId === "type") return Boolean(petTypeFromSpecies(context.species));
  return false;
}

export function skipKnownPetIntroQuestions(
  questionIndex: number,
  questionIds: readonly string[],
  context: PetLetterContext | null | undefined,
  direction: 1 | -1 = 1,
): number {
  let next = Math.min(Math.max(questionIndex, 0), Math.max(questionIds.length - 1, 0));
  while (next >= 0 && next < questionIds.length && isKnownPetIntroQuestion(questionIds[next], context)) {
    next += direction;
  }
  return Math.min(Math.max(next, 0), questionIds.length);
}

export function buildPetLetterContextBlock(
  context: PetLetterContext | null | undefined,
  locale: "en" | "ko",
): string {
  if (!context) return "";
  const details = [
    context.species ? `${locale === "ko" ? "저장된 종류" : "Saved species"}: ${context.species}` : "",
    context.lifeStatus !== "unspecified"
      ? `${locale === "ko" ? "저장된 상태" : "Saved life status"}: ${context.lifeStatus}`
      : "",
    context.birthday ? `${locale === "ko" ? "생일" : "Birthday"}: ${context.birthday}` : "",
    context.adoptedOn ? `${locale === "ko" ? "함께 살기 시작한 날" : "Adoption date"}: ${context.adoptedOn}` : "",
    context.traits ? `${locale === "ko" ? "저장된 특징" : "Saved traits"}: ${context.traits}` : "",
  ].filter(Boolean);
  if (details.length === 0) return "";
  return [locale === "ko" ? "[기존 반려동물 프로필 정보]" : "[Existing pet profile details]", ...details].join("\n");
}
