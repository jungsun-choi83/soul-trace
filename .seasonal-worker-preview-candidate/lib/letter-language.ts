import type { Locale } from "./i18n.ts";

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ko";
}

/**
 * A generated letter owns its language independently from the interface locale.
 * The second value supports older session records that stored only resultLocale.
 */
export function resolveLetterLanguage(
  generationLocale: unknown,
  legacyResultLocale?: unknown,
): Locale {
  if (isLocale(generationLocale)) return generationLocale;
  if (isLocale(legacyResultLocale)) return legacyResultLocale;
  return "en";
}
