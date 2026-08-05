import type { Locale } from "@/lib/i18n";

/** 모델이 준 해시태그 후보를 정리해 항상 3개(# 접두)로 맞춘다. */
export function normalizePersonalityTags(raw: unknown, locale: Locale): string[] {
  const tags: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      let s = String(item).trim();
      if (!s) continue;
      s = s.replace(/^#+/u, "").replace(/\s+/gu, "");
      if (!s) continue;
      tags.push(`#${s}`);
      if (tags.length >= 3) break;
    }
  }
  const pad =
    locale === "ko"
      ? ["따뜻한마음", "함께한발자국", "빛의동반"]
      : ["warmHeart", "pawPrints", "quietLight"];
  while (tags.length < 3) {
    tags.push(`#${pad[tags.length]}`);
  }
  return tags.slice(0, 3);
}
