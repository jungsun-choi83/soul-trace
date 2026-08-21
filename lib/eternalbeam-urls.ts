/**
 * 메인 브랜드 사이트 (이터널빔닷컴) — 킥스타터·랜딩
 * Vercel: `NEXT_PUBLIC_ETERNALBEAM_HOME_URL` 로 덮어쓸 수 있음 (기본은 eternalbeam.com)
 */
export function getEternalBeamMainUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ETERNALBEAM_HOME_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://eternalbeam.com";
}

/**
 * 편지 핸드오프 도착지 — Eternal Beam 앱(기기 웹앱).
 * Vercel: `NEXT_PUBLIC_ETERNALBEAM_IMPORT_URL` 로 덮어쓸 수 있음.
 */
export function getEternalBeamImportUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ETERNALBEAM_IMPORT_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://device.eternalbeam.com/soul-trace/import";
}

/**
 * 핸드오프 URL 을 만든다. **traceId 와 불투명 토큰만 실린다.**
 *
 * 편지 본문·설문·이메일·펫 이미지는 여기 들어가지 않는다 — URL 은 브라우저
 * 기록·리퍼러·공유 메시지에 남고, 한 번 새면 되돌릴 수 없다.
 */
export function buildHandoffUrl(traceId: string, handoff: string): string {
  const url = new URL(getEternalBeamImportUrl());
  url.searchParams.set("traceId", traceId);
  url.searchParams.set("handoff", handoff);
  return url.toString();
}

/** 공식 인스타그램. Vercel: `NEXT_PUBLIC_ETERNALBEAM_INSTAGRAM_URL` 로 덮어쓸 수 있음 */
export function getEternalBeamInstagramUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ETERNALBEAM_INSTAGRAM_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://www.instagram.com/eternalbeam/";
}
