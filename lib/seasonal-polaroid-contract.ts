import { isLocale, type Locale } from "./i18n.ts";
import {
  HALLOWEEN_POLAROID_THEME,
  optionsForStatus,
  type PolaroidSpecies,
  type PolaroidStatus,
  type SeasonalOption,
  type SeasonalPolaroidTheme,
} from "./seasonal-polaroid.ts";
import {
  SEASONAL_POLAROID_PHOTO_MAX_BYTES,
  validateSeasonalPolaroidPhoto,
} from "./seasonal-polaroid-photo.ts";

export type SeasonalPolaroidThemeId = "halloween";
export type SeasonalPolaroidLocale = Locale;

export type SeasonalPolaroidQuestionnaire = {
  themeId: SeasonalPolaroidThemeId | string;
  locale: SeasonalPolaroidLocale | string;
  petName: string;
  species: PolaroidSpecies | string;
  status: PolaroidStatus | string;
  costume: string;
  scene: string;
  vibe: string;
  personalities: string[];
  habit: string;
  customHabit?: string;
  favoriteTreat: string;
  customTreat?: string;
  callName: string;
  customCallName?: string;
  personalDetail?: string;
  generationNonce?: string;
};

export type SeasonalPolaroidRequest = {
  answers: SeasonalPolaroidQuestionnaire;
  primaryPhoto: File;
};

export type SeasonalPolaroidImageReference = {
  kind: "data-url" | "private-object";
  dataUrl?: string;
  objectKey?: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export type SeasonalPolaroidMemo = {
  lines: [string, string, string, string];
  locale: SeasonalPolaroidLocale;
};

export type SeasonalPolaroidGenerationMetadata = {
  themeId: SeasonalPolaroidThemeId;
  imageModel: string;
  textModel: string | null;
  generatedAt: string;
};

export type SeasonalPolaroidResult = {
  resultId: string;
  image: SeasonalPolaroidImageReference;
  memo: SeasonalPolaroidMemo;
  themeId: SeasonalPolaroidThemeId;
  costumeId: string;
  generation: SeasonalPolaroidGenerationMetadata;
  saveProof: string | null;
};

export type SeasonalPolaroidValidationField =
  | "themeId"
  | "locale"
  | "petName"
  | "species"
  | "status"
  | "costume"
  | "scene"
  | "vibe"
  | "personalities"
  | "habit"
  | "customHabit"
  | "favoriteTreat"
  | "customTreat"
  | "callName"
  | "customCallName"
  | "personalDetail"
  | "generationNonce"
  | "primaryPhoto"
  // Kept for validating/cleaning legacy queued attempts; new requests expose
  // only the primary photo.
  | "secondaryPhoto";

export type SeasonalPolaroidValidationIssue = {
  field: SeasonalPolaroidValidationField;
  code:
    | "required"
    | "unsupported"
    | "too_long"
    | "too_many"
    | "duplicate"
    | "restricted"
    | "photo_required"
    | "photo_empty"
    | "photo_type"
    | "photo_heic"
    | "photo_size"
    | "photo_signature";
};

export type SeasonalPolaroidValidationResult =
  | { valid: true; theme: SeasonalPolaroidTheme; answers: SeasonalPolaroidQuestionnaire }
  | { valid: false; issues: SeasonalPolaroidValidationIssue[] };

export const SEASONAL_POLAROID_THEME_IDS: readonly SeasonalPolaroidThemeId[] = ["halloween"];

const THEMES: Record<SeasonalPolaroidThemeId, SeasonalPolaroidTheme> = {
  halloween: HALLOWEEN_POLAROID_THEME,
};

const SPECIES: readonly PolaroidSpecies[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];
const STATUSES: readonly PolaroidStatus[] = ["living", "passed"];
const MAX_NAME_LENGTH = 12;
const MAX_CUSTOM_TREAT_LENGTH = 60;
const MAX_CUSTOM_HABIT_LENGTH = 60;
const MAX_CALL_NAME_LENGTH = 40;
const MAX_PERSONAL_DETAIL_LENGTH = 60;
const MAX_GENERATION_NONCE_LENGTH = 128;

export function seasonalPolaroidTheme(themeId: string): SeasonalPolaroidTheme | undefined {
  return Object.prototype.hasOwnProperty.call(THEMES, themeId)
    ? THEMES[themeId as SeasonalPolaroidThemeId]
    : undefined;
}

function hasOption(options: readonly SeasonalOption[], id: string): boolean {
  return options.some((item) => item.id === id);
}

function addIssue(
  issues: SeasonalPolaroidValidationIssue[],
  field: SeasonalPolaroidValidationField,
  code: SeasonalPolaroidValidationIssue["code"],
) {
  issues.push({ field, code });
}

function validatePhoto(
  value: unknown,
  field: "primaryPhoto",
  issues: SeasonalPolaroidValidationIssue[],
) {
  if (value === undefined || value === null) {
    addIssue(issues, field, "photo_required");
    return;
  }
  if (typeof value !== "object" || value === null || !("size" in value) || !("type" in value) || !("name" in value)) {
    addIssue(issues, field, "photo_required");
    return;
  }
  const file = value as Pick<File, "name" | "size" | "type">;
  if (
    typeof file.name !== "string" ||
    typeof file.type !== "string" ||
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    file.size < 0
  ) {
    addIssue(issues, field, "photo_required");
    return;
  }
  if (!file.size) {
    addIssue(issues, field, "photo_empty");
    return;
  }
  if (file.size > SEASONAL_POLAROID_PHOTO_MAX_BYTES) {
    addIssue(issues, field, "photo_size");
    return;
  }
  if (/image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    addIssue(issues, field, "photo_heic");
    return;
  }
  if (validateSeasonalPolaroidPhoto(file as File)) addIssue(issues, field, "photo_type");
}

export function validateSeasonalPolaroidRequest(
  request: SeasonalPolaroidRequest,
): SeasonalPolaroidValidationResult {
  const issues: SeasonalPolaroidValidationIssue[] = [];
  const answers = request?.answers;
  if (!answers || typeof answers !== "object") {
    addIssue(issues, "themeId", "required");
    validatePhoto(request?.primaryPhoto, "primaryPhoto", issues);
    return { valid: false, issues };
  }

  const theme = seasonalPolaroidTheme(String(answers.themeId ?? ""));
  if (!theme) addIssue(issues, "themeId", "unsupported");
  if (!isLocale(String(answers.locale ?? ""))) addIssue(issues, "locale", "unsupported");

  const petName = typeof answers.petName === "string" ? answers.petName.trim() : "";
  if (!petName) addIssue(issues, "petName", "required");
  else if (petName.length > MAX_NAME_LENGTH) addIssue(issues, "petName", "too_long");

  const species = String(answers.species ?? "");
  if (!SPECIES.includes(species as PolaroidSpecies)) addIssue(issues, "species", "unsupported");
  const status = String(answers.status ?? "");
  if (!STATUSES.includes(status as PolaroidStatus)) addIssue(issues, "status", "unsupported");

  if (theme && STATUSES.includes(status as PolaroidStatus)) {
    const typedStatus = status as PolaroidStatus;
    const costume = String(answers.costume ?? "");
    const scene = String(answers.scene ?? "");
    const vibe = String(answers.vibe ?? "");
    if (!costume) addIssue(issues, "costume", "required");
    else if (!hasOption(optionsForStatus(theme.costumes, typedStatus), costume)) addIssue(issues, "costume", "restricted");
    if (!scene) addIssue(issues, "scene", "required");
    else if (!hasOption(optionsForStatus(theme.scenes, typedStatus), scene)) addIssue(issues, "scene", "restricted");
    if (!vibe) addIssue(issues, "vibe", "required");
    else if (!hasOption(optionsForStatus(theme.vibes, typedStatus), vibe)) addIssue(issues, "vibe", "restricted");
  }

  const personalities = Array.isArray(answers.personalities) ? answers.personalities : [];
  if (personalities.length < 1) addIssue(issues, "personalities", "required");
  if (personalities.length > 2) addIssue(issues, "personalities", "too_many");
  if (new Set(personalities).size !== personalities.length) addIssue(issues, "personalities", "duplicate");
  if (theme && personalities.some((id) => !hasOption(theme.personalities, String(id)))) addIssue(issues, "personalities", "unsupported");

  if (theme && SPECIES.includes(species as PolaroidSpecies)) {
    const speciesOptions = theme.habitsBySpecies[species as PolaroidSpecies];
    const habit = String(answers.habit ?? "");
    if (!habit) addIssue(issues, "habit", "required");
    else if (habit !== "custom" && !hasOption(speciesOptions, habit)) addIssue(issues, "habit", "unsupported");
    if (habit === "custom" && !String(answers.customHabit ?? "").trim()) addIssue(issues, "customHabit", "required");
    const treatOptions = theme.treatsBySpecies[species as PolaroidSpecies];
    const favoriteTreat = String(answers.favoriteTreat ?? "");
    if (!favoriteTreat) addIssue(issues, "favoriteTreat", "required");
    else if (!hasOption(treatOptions, favoriteTreat)) addIssue(issues, "favoriteTreat", "unsupported");
    if (favoriteTreat === "custom" && !String(answers.customTreat ?? "").trim()) addIssue(issues, "customTreat", "required");
  }

  // "Something else" ("custom") was retired from the questionnaire. Drafts and
  // queued jobs that still carry it mean "A name" with the same typed name.
  const callName = String(answers.callName ?? "") === "custom" ? "by-name" : String(answers.callName ?? "");
  if (!callName) addIssue(issues, "callName", "required");
  else if (!theme || !hasOption(theme.callNames, callName)) addIssue(issues, "callName", "unsupported");
  if (callName === "by-name" && !String(answers.customCallName ?? "").trim()) addIssue(issues, "customCallName", "required");
  if (String(answers.customTreat ?? "").length > MAX_CUSTOM_TREAT_LENGTH) addIssue(issues, "customTreat", "too_long");
  if (String(answers.customHabit ?? "").length > MAX_CUSTOM_HABIT_LENGTH) addIssue(issues, "customHabit", "too_long");
  if (String(answers.customCallName ?? "").length > MAX_CALL_NAME_LENGTH) addIssue(issues, "customCallName", "too_long");
  if (String(answers.personalDetail ?? "").length > MAX_PERSONAL_DETAIL_LENGTH) addIssue(issues, "personalDetail", "too_long");
  if (String(answers.generationNonce ?? "").length > MAX_GENERATION_NONCE_LENGTH) {
    addIssue(issues, "generationNonce", "too_long");
  }

  validatePhoto(request.primaryPhoto, "primaryPhoto", issues);

  if (issues.length > 0) return { valid: false, issues };
  return {
    valid: true,
    theme: theme!,
    answers: {
      ...answers,
      themeId: answers.themeId,
      locale: answers.locale,
      petName,
      species,
      status,
      personalities: personalities.map(String),
      callName,
      customHabit: String(answers.customHabit ?? "").trim(),
      customTreat: String(answers.customTreat ?? "").trim(),
      customCallName: String(answers.customCallName ?? "").trim(),
      personalDetail: String(answers.personalDetail ?? "").trim(),
      generationNonce: String(answers.generationNonce ?? "").trim(),
    },
  };
}

export function isSeasonalPolaroidMemo(value: unknown): value is SeasonalPolaroidMemo {
  if (!value || typeof value !== "object") return false;
  const memo = value as Partial<SeasonalPolaroidMemo>;
  return Boolean(
    isLocale(memo.locale) &&
    Array.isArray(memo.lines) &&
    memo.lines.length === 4 &&
    memo.lines.every((line) => typeof line === "string" && line.trim().length > 0 && line.length <= 240),
  );
}

export function normalizeSeasonalPolaroidMemo(value: unknown): SeasonalPolaroidMemo | null {
  if (!isSeasonalPolaroidMemo(value)) return null;
  return {
    locale: value.locale,
    lines: value.lines.map((line) => line.trim()) as [string, string, string, string],
  };
}
