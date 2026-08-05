/**
 * 메인 브랜드 사이트 (이터널빔닷컴) — 킥스타터·랜딩
 * Vercel: `NEXT_PUBLIC_ETERNALBEAM_HOME_URL` 로 덮어쓸 수 있음 (기본은 eternalbeam.com)
 */
export function getEternalBeamMainUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ETERNALBEAM_HOME_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://eternalbeam.com";
}

/** 공식 인스타그램. Vercel: `NEXT_PUBLIC_ETERNALBEAM_INSTAGRAM_URL` 로 덮어쓸 수 있음 */
export function getEternalBeamInstagramUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ETERNALBEAM_INSTAGRAM_URL?.trim();
  if (fromEnv) return fromEnv;
  return "https://www.instagram.com/eternalbeam/";
}
