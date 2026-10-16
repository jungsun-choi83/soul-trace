import type { Locale } from "./i18n.ts";

export type GeneratedLetterStructure = {
  title: string;
  paragraphs: string[];
  endingPhrase: string;
};

export const ENDING_PHRASE_MARKER = "[[ENDING_PHRASE]]";

export function splitBodyParagraphs(body: string): string[] {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function isShortEndingPhrase(value: string, locale: Locale): boolean {
  const phrase = value.trim();
  if (!phrase || /[\r\n]/.test(phrase)) return false;
  if (locale === "en") {
    const words = phrase.split(/\s+/).filter(Boolean);
    return words.length >= 3 && words.length <= 8;
  }
  return Array.from(phrase).length <= 24;
}

export function createGeneratedLetterStructure(
  title: string,
  body: string,
  endingPhrase: string,
  locale: Locale,
): GeneratedLetterStructure {
  return {
    title: title.trim(),
    paragraphs: splitBodyParagraphs(body),
    endingPhrase: isShortEndingPhrase(endingPhrase, locale) ? endingPhrase.trim() : "",
  };
}

export function parseMarkedLetter(
  title: string,
  rawLetter: string,
  locale: Locale,
): GeneratedLetterStructure {
  const markerIndex = rawLetter.lastIndexOf(ENDING_PHRASE_MARKER);
  if (markerIndex < 0) {
    return createGeneratedLetterStructure(title, rawLetter, "", locale);
  }
  const body = rawLetter.slice(0, markerIndex).trimEnd();
  const endingPhrase = rawLetter.slice(markerIndex + ENDING_PHRASE_MARKER.length).trim();
  return createGeneratedLetterStructure(title, body, endingPhrase, locale);
}

export function serializeGeneratedLetter(structure: GeneratedLetterStructure): string {
  return [...structure.paragraphs, structure.endingPhrase].filter(Boolean).join("\n\n");
}

/** Hide the streaming protocol marker without treating preceding text as an ending. */
export function visibleStreamingBody(rawLetter: string): string {
  const markerIndex = rawLetter.indexOf(ENDING_PHRASE_MARKER);
  if (markerIndex >= 0) return rawLetter.slice(0, markerIndex).trimEnd();
  return rawLetter.replace(/\n?\[\[[A-Z_]*$/u, "").trimEnd();
}
