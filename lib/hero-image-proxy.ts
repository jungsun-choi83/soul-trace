/**
 * OpenAI DALL·E 임시 URL만 허용 — 오픈 프록시 방지.
 * (호스트 패턴은 API가 반환하는 Blob 스토리지 기준)
 */
export function isAllowedHeroImageFetchUrl(candidate: URL): boolean {
  if (candidate.protocol !== "https:") return false;
  const h = candidate.hostname.toLowerCase();
  if (!h.endsWith(".blob.core.windows.net")) return false;
  const sub = h.slice(0, -".blob.core.windows.net".length);
  return sub.startsWith("oaidalleapiprod") || sub.startsWith("dalleprod");
}

/** 화면·캡처용: 동일 출처 프록시 경로 (html-to-image CORS 회피) */
export function heroImageSrcForApp(absoluteOrEmpty: string | null | undefined): string | null {
  if (!absoluteOrEmpty?.trim()) return null;
  const u = absoluteOrEmpty.trim();
  if (u.startsWith("/")) return u;
  try {
    const parsed = new URL(u);
    if (!isAllowedHeroImageFetchUrl(parsed)) return null;
    return `/api/proxy-hero-image?url=${encodeURIComponent(u)}`;
  } catch {
    return null;
  }
}
