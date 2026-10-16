const TECHNICAL_PATTERNS = [
  /OPENAI/i,
  /API_KEY/i,
  /billing/i,
  /Invalid server event/i,
  /Stream ended before completion/i,
  /No response body/i,
  /Empty (letter|AI|personality)/i,
  /Unknown error while generating/i,
  /성향 분석 응답이 비어/i,
  /AI 편지 응답이 비어/i,
  /AI 응답이 비어/i,
];

/** 소비자 화면 — 기술·서버 메시지는 일반 안내로 치환 */
export function userFacingErrorMessage(
  err: unknown,
  fallback: string,
): string {
  const raw = err instanceof Error ? err.message.trim() : "";
  if (!raw) return fallback;
  if (TECHNICAL_PATTERNS.some((re) => re.test(raw))) return fallback;
  if (raw.length > 160) return fallback;
  return raw;
}
