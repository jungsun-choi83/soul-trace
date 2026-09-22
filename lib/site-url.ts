const fallback = "https://soultrace.eternalbeam.com";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? fallback).replace(
  /\/$/,
  "",
);

export const SITE_DESCRIPTION =
  "반려동물에 대한 기억을 바탕으로, 아이의 마음을 닮은 편지를 만들어 드립니다. 완성한 이야기는 이터널 빔으로 이어갈 수 있습니다.";

export const SITE_TITLE = "Soul Trace | 반려동물의 이야기를 한 편의 편지로";

export const noIndexRobots = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;
