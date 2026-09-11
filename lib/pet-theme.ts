import type { PetType } from "./pet-profile.ts";

export type PetThemeKey = Exclude<PetType, "other">;

export type PetTheme = {
  key: PetThemeKey;
  decoration: null;
  background: string;
  stamp: null;
  icon: null;
};

export type DefaultPetTheme = {
  key: "default";
  decoration: null;
  background: null;
  stamp: null;
  icon: null;
};

export const DEFAULT_PET_THEME: DefaultPetTheme = {
  key: "default",
  decoration: null,
  background: null,
  stamp: null,
  icon: null,
};

export const PET_THEMES: Readonly<Record<PetThemeKey, PetTheme>> = {
  dog: { key: "dog", decoration: null, background: "/backgrounds/pets/dog-bg.png", stamp: null, icon: null },
  cat: { key: "cat", decoration: null, background: "/backgrounds/pets/cat-bg.png", stamp: null, icon: null },
  rabbit: { key: "rabbit", decoration: null, background: "/backgrounds/pets/rabbit-bg.png", stamp: null, icon: null },
  hamster: { key: "hamster", decoration: null, background: "/backgrounds/pets/hamster-bg.png", stamp: null, icon: null },
  bird: { key: "bird", decoration: null, background: "/backgrounds/pets/bird-bg.png", stamp: null, icon: null },
};

export type ResolvedPetTheme = PetTheme | DefaultPetTheme;

export function getPetTheme(petType: unknown): ResolvedPetTheme {
  if (typeof petType !== "string") return DEFAULT_PET_THEME;
  const normalized = petType.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PET_THEMES, normalized)
    ? PET_THEMES[normalized as PetThemeKey]
    : DEFAULT_PET_THEME;
}

export function getQuestionnairePetTheme(
  petType: unknown,
  petTypeQuestionCompleted: boolean,
): ResolvedPetTheme {
  return petTypeQuestionCompleted ? getPetTheme(petType) : DEFAULT_PET_THEME;
}
