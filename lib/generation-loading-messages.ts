import type { Locale } from "@/lib/i18n";

function displayPetName(petName: string, locale: Locale): string {
  const t = petName.trim();
  if (t.length > 0) return t;
  return locale === "ko" ? "아이" : "your companion";
}

/** 제출 직후·스트리밍 대기 중 감성 로딩 문구 (랜덤 1개) */
export function pickGenerationLoadingMessage(locale: Locale, petName: string): string {
  const name = displayPetName(petName, locale);
  if (locale === "ko") {
    const lines = [
      `${name}와의 추억을 빛으로 빚어내고 있습니다…`,
      `${name}의 발자국 소리를 따라 편지를 적고 있어요…`,
      `햇살 속 ${name}의 하루를 떠올리며 글자를 새기고 있습니다…`,
      `${name}가 가장 좋아했던 공기를 담아 편지를 이어가고 있어요…`,
      `무지개 다리 너머, ${name}의 목소리를 불러오는 중입니다…`,
      `당신의 마음속 ${name}를 부드럽게 비추는 문장을 준비하고 있어요…`,
    ];
    return lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
  }
  const lines = [
    `Weaving your memories with ${name} into light…`,
    `Tracing little pawprints into words for you…`,
    `Recalling the sun on ${name}'s fur, line by line…`,
    `Carrying the air of their favorite place into this letter…`,
    `Listening across the bridge for ${name}'s gentle voice…`,
    `Setting down the warmth they left in your heart…`,
  ];
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
}
