import type { Locale } from "@/lib/i18n";
import type { GeneratedLetterStructure } from "@/lib/generated-letter";

const HANGUL = /[\u3131-\u318e\uac00-\ud7a3]/u;
const ENGLISH_SENTENCE = /\b[A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*){2,}\b/u;
const QUOTED_PHRASE = /["“‘「](.*?)["”’」]/gu;

function withoutAllowedText(text: string, allowedText: readonly string[]): string {
  return allowedText
    .filter((value) => value.trim().length > 0)
    .sort((a, b) => b.length - a.length)
    .reduce((remaining, value) => remaining.split(value).join(" "), text);
}

/** Only explicitly quoted answer text is treated as wording the user asked us to preserve. */
export function extractExplicitlyPreservedPhrases(answers: readonly string[]): string[] {
  const phrases = new Set<string>();
  for (const answer of answers) {
    for (const match of answer.matchAll(QUOTED_PHRASE)) {
      const phrase = match[1]?.trim();
      if (phrase) phrases.add(phrase);
    }
  }
  return [...phrases];
}

export function hasUnexpectedLanguage(
  text: string,
  locale: Locale,
  allowedText: readonly string[] = [],
): boolean {
  const candidate = withoutAllowedText(text, allowedText);
  return locale === "en" ? HANGUL.test(candidate) : ENGLISH_SENTENCE.test(candidate);
}

export function letterMatchesLocale(
  letter: GeneratedLetterStructure,
  locale: Locale,
  allowedText: readonly string[] = [],
): boolean {
  return !hasUnexpectedLanguage(
    [...letter.paragraphs, letter.endingPhrase].join("\n"),
    locale,
    allowedText,
  );
}

/** Locale is deliberately part of the identity, preventing cross-language reuse. */
export function generationCacheKey(email: string, mode: string, locale: Locale): string {
  return `${mode}:${email.trim().toLowerCase()}:${locale}`;
}
