import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Eternal Beam 핸드오프 토큰 — 편지 하나를 넘길 수 있는 **일회용 능력**.
 *
 * Soul Trace 에는 로그인이 없다. 그래서 "이 브라우저가 이 편지의 주인이다"를
 * 증명할 기존 수단이 없고, 이 토큰이 그 자리를 대신한다. 토큰을 가진 쪽이
 * 편지를 가져간다 — 그러므로 짧게 살고, 한 번만 쓰이고, 편지 하나만 가리켜야 한다.
 */

/** 15분. URL 은 히스토리·리퍼러·채팅에 남으므로 오래 살면 안 된다. */
export const HANDOFF_TTL_MS = 15 * 60 * 1000;

/** 256비트. base64url 로 43자. */
const TOKEN_BYTES = 32;

/** 원문 토큰. **발급 응답에 한 번만 실리고 서버에는 남지 않는다.** */
export function createHandoffToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** 저장·조회용 sha256 hex. 표가 유출돼도 원문을 되살릴 수 없다. */
export function hashHandoffToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function handoffExpiryFrom(now: Date): Date {
  return new Date(now.getTime() + HANDOFF_TTL_MS);
}

/** base64url 43자 — 발급한 모양 그대로인지. DB 를 때리기 전에 쓰레기를 걸러 낸다. */
export function looksLikeHandoffToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeLetterId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * 서비스 토큰 비교 — **길이·내용 모두 상수 시간**으로.
 *
 * `a === b` 는 첫 다른 바이트에서 즉시 멈춘다. 그 시간 차이를 반복 측정하면
 * 토큰을 한 바이트씩 알아낼 수 있다. 서버 대 서버 credential 이라 공격자가
 * 얼마든지 반복할 수 있으므로 여기서는 값싼 방어가 아니라 필수다.
 */
export function serviceTokenMatches(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  // 길이가 다르면 timingSafeEqual 이 예외를 던진다. 길이 자체도 흘리지 않도록
  // 양쪽을 한 번 더 해시해 **항상 같은 길이**로 만든 뒤 비교한다.
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
