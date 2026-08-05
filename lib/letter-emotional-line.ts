import type { Locale } from "@/lib/i18n";

const KO_HINT =
  /사랑|그리|함께|빛|엄마|아빠|기억|고마|미안|좋아|행복|따뜻|마음|언제|항상|영원|편안|보고|싶|언제나|늘|편지|인사/;
const EN_HINT =
  /love|miss|light|always|remember|together|mom|dad|heart|warm|dear|forever|here|shine|thank|still|close/i;

function scoreSentence(s: string, locale: Locale): number {
  const hint = locale === "ko" ? KO_HINT : EN_HINT;
  const t = s.replace(/\s+/g, " ").trim();
  let score = Math.min(t.length, 160);
  if (hint.test(t)) score += 80;
  if (/[!?…]|\.{3}/.test(t)) score += 12;
  return score;
}

export function normalizeLetterOneLine(s: string): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}…` : oneLine;
}

/** 편지를 문장 단위로 나눈 뒤 감성 점수 상위 `maxCount`개(중복 제거) */
export function collectTopEmotionalLetterSentences(
  letter: string,
  locale: Locale,
  maxCount: number,
): string[] {
  const raw = letter.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  let parts = raw
    .split(/(?<=[.!?…。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);

  if (parts.length === 0) {
    parts = raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 12);
  }

  if (parts.length === 0) {
    return [normalizeLetterOneLine(raw.slice(0, 200))];
  }

  const seen = new Set<string>();
  return parts
    .map((s) => ({ s, score: scoreSentence(s, locale) }))
    .sort((a, b) => b.score - a.score)
    .filter(({ s }) => {
      const key = s.replace(/\s+/g, " ").slice(0, 96);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, Math.max(1, maxCount))
    .map(({ s }) => normalizeLetterOneLine(s));
}

/**
 * 상위 3~5개 후보 중 하나를 무작위로 고릅니다.
 * 공유 카드마다 다른 문장이 나가도록 `captureImage` 직전에 호출하는 용도.
 */
export function pickRandomBestLetterSentence(letter: string, locale: Locale): string {
  const poolTarget = 3 + Math.floor(Math.random() * 3);
  const pool = collectTopEmotionalLetterSentences(letter, locale, poolTarget);
  if (pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0]!;
}

/** 스토리 카드 외: 결정적 1순위 한 줄 */
export function pickEmotionalLetterSentence(letter: string, locale: Locale): string {
  const pool = collectTopEmotionalLetterSentences(letter, locale, 1);
  return pool[0] ?? "";
}
