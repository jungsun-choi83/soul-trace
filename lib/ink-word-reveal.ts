export const MAX_INK_REVEAL_DURATION_MS = 12_000;
export const STREAM_REVEAL_WORD_THRESHOLD = 10;

export type InkRevealToken = {
  text: string;
  isWord: boolean;
  delayMs: number;
  durationMs: number;
};

const TIMING_VARIATION_MS = [-12, 8, 0, 18, -6, 12] as const;

function baseWordDelay(wordCount: number): number {
  if (wordCount > 160) return 62;
  if (wordCount > 110) return 72;
  if (wordCount > 70) return 88;
  if (wordCount > 35) return 104;
  return 122;
}

function punctuationPause(text: string): number {
  if (/[.!?…]["'”’)}\]]*$/u.test(text)) return 145;
  if (/[,;:]["'”’)}\]]*$/u.test(text)) return 70;
  return 0;
}

export function completeStreamedLetterPrefix(raw: string): string {
  const marker = "[[ENDING_PHRASE]]";
  const markerIndex = raw.indexOf(marker);
  let candidate = markerIndex >= 0 ? raw.slice(0, markerIndex) : raw;
  if (markerIndex < 0) {
    for (let length = Math.min(marker.length - 1, candidate.length); length > 0; length -= 1) {
      if (marker.startsWith(candidate.slice(-length))) {
        candidate = candidate.slice(0, -length);
        break;
      }
    }
  }
  const lastWhitespace = candidate.search(/\s+\S*$/u);
  if (lastWhitespace < 0) return "";
  const trailing = candidate.slice(lastWhitespace);
  if (/^\s+$/u.test(trailing)) return candidate;
  return candidate.slice(0, lastWhitespace + trailing.match(/^\s+/u)![0].length);
}

export function revealUnits(text: string): string[] {
  return text.match(/\S+\s*/gu) ?? [];
}

export function shouldStartBufferedReveal(text: string, complete: boolean): boolean {
  const units = revealUnits(text);
  return complete || units.length >= STREAM_REVEAL_WORD_THRESHOLD ||
    (units.length >= 4 && /[.!?…]["'”’)}\]]*\s*$/u.test(text));
}

export function bufferedWordDelayMs(word: string, index: number, totalWords: number): number {
  const normal = Math.max(22, Math.min(122, Math.floor(10_000 / Math.max(1, totalWords))));
  const variation = TIMING_VARIATION_MS[index % TIMING_VARIATION_MS.length];
  return Math.max(18, normal + variation) + punctuationPause(word);
}

/** Keeps every whitespace run so the animated DOM has exactly the final text layout. */
export function buildInkRevealPlan(
  sections: readonly string[],
  maxDurationMs = MAX_INK_REVEAL_DURATION_MS,
): InkRevealToken[][] {
  const pieces = sections.map((section) => section.split(/(\s+)/u).filter(Boolean));
  const wordCount = pieces.flat().filter((piece) => !/^\s+$/u.test(piece)).length;
  const baseDelay = baseWordDelay(wordCount);
  let elapsed = 0;
  let wordIndex = 0;

  const plan = pieces.map((section, sectionIndex) => {
    const tokens = section.map((piece): InkRevealToken => {
      if (/^\s+$/u.test(piece)) {
        if (/\n\s*\n/u.test(piece)) elapsed += 210;
        else if (/\n/u.test(piece)) elapsed += 90;
        return { text: piece, isWord: false, delayMs: 0, durationMs: 0 };
      }

      const delayMs = elapsed;
      const variation = TIMING_VARIATION_MS[wordIndex % TIMING_VARIATION_MS.length];
      elapsed += Math.max(48, baseDelay + variation) + punctuationPause(piece);
      wordIndex += 1;
      return {
        text: piece,
        isWord: true,
        delayMs,
        durationMs: Math.max(120, Math.min(210, baseDelay + 72)),
      };
    });
    const hasLaterWords = pieces.slice(sectionIndex + 1).some((later) =>
      later.some((piece) => !/^\s+$/u.test(piece)),
    );
    if (tokens.some((token) => token.isWord) && hasLaterWords) elapsed += 210;
    return tokens;
  });

  const naturalDuration = elapsed + Math.max(120, baseDelay + 72);
  if (naturalDuration <= maxDurationMs || naturalDuration === 0) return plan;

  const scale = maxDurationMs / naturalDuration;
  return plan.map((section) => section.map((token) => token.isWord
    ? {
        ...token,
        delayMs: Math.round(token.delayMs * scale),
        durationMs: Math.max(90, Math.round(token.durationMs * scale)),
      }
    : token));
}
