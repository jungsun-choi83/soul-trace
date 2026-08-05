import type { Locale } from "@/lib/i18n";

/** connect.eternalbeam.com에서 읽을 수 있도록 동일 키로 저장 */
export const ETERNALBEAM_CONNECT_STORAGE_KEY = "eternalbeam_soul_trace_connect";

/** connect·랜딩 연동용 단순 키 (스크립트에서 바로 읽기) */
export const ST_LETTER_KEY = "st_letter";
export const ST_EMAIL_KEY = "st_email";

export type EternalBeamConnectPayload = {
  letter: string;
  email: string;
  petName: string;
  preferredScenery: string;
  locale: Locale;
  source: "soultrace";
  /** localStorage 저장 시 자동 부여 */
  ts?: number;
};

/** 이터널 커넥트(봉안당) — https://connect.eternalbeam.com/ */
export const ETERNALBEAM_CONNECT_ORIGIN = "https://connect.eternalbeam.com";
/** 쿼리 길이 보호선. 초과 시 잘라서라도 message 전달(다른 도메인 localStorage는 공유 불가). */
const MAX_MESSAGE_QUERY_ENCODED_LEN = 7000;

function toQuerySafeMessage(letter: string): string {
  if (!letter) return "";
  let out = letter;
  while (out.length > 0 && encodeURIComponent(out).length > MAX_MESSAGE_QUERY_ENCODED_LEN) {
    out = out.slice(0, Math.floor(out.length * 0.92));
  }
  return out;
}

/**
 * 편지·식별 정보를 localStorage에 저장하고, message 쿼리에도 함께 담습니다.
 * (connect.eternalbeam.com은 soultrace.eternalbeam.com의 localStorage를 직접 읽을 수 없음)
 */
export function persistConnectPayload(payload: EternalBeamConnectPayload): void {
  const full: EternalBeamConnectPayload = { ...payload, ts: Date.now() };
  try {
    localStorage.setItem(ETERNALBEAM_CONNECT_STORAGE_KEY, JSON.stringify(full));
    localStorage.setItem(ST_LETTER_KEY, payload.letter);
    localStorage.setItem(ST_EMAIL_KEY, payload.email.trim());
  } catch {
    /* quota / private mode */
  }
}

export function buildConnectUrl(payload: EternalBeamConnectPayload): string {
  const url = new URL("/", ETERNALBEAM_CONNECT_ORIGIN);
  url.searchParams.set("source", "soultrace");
  const email = payload.email.trim();
  if (email) {
    url.searchParams.set("user", email);
  }
  const letter = payload.letter;
  if (letter.length > 0) {
    url.searchParams.set("message", toQuerySafeMessage(letter));
  }
  return url.toString();
}

export function prepareConnectOpen(payload: EternalBeamConnectPayload): string {
  persistConnectPayload(payload);
  return buildConnectUrl(payload);
}

/** 랜딩으로 돌아갈 때 등 — 임시 전달 값 제거 */
export function clearSoulTraceConnectDrafts(): void {
  try {
    localStorage.removeItem(ST_LETTER_KEY);
    localStorage.removeItem(ST_EMAIL_KEY);
    localStorage.removeItem(ETERNALBEAM_CONNECT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
