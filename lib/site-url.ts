const fallback = "https://soultrace.eternalbeam.com";

function resolveSiteUrl() {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? fallback).replace(/\s+/g, "");
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export const SITE_URL = resolveSiteUrl();

export const SITE_DESCRIPTION =
  "반려동물에 대한 기억을 바탕으로, 아이의 마음을 닮은 편지를 만들어 드립니다. 완성한 이야기는 이터널 빔으로 이어갈 수 있습니다.";

export const SITE_TITLE = "소울트레이스 | 반려동물 마음을 아이의 편지로";

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;
