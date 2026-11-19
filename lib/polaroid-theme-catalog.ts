import type { SeasonalPolaroidTheme } from "./seasonal-polaroid.ts";

export type PolaroidCategory = "art-style" | "seasonal";

export type PolaroidThemeId =
  | "halloween"
  | "felt-doll"
  | "gouache-story"
  | "paper-collage"
  | "starlight-oil"
  | "miniature-world"
  | "crayon-diary"
  | "christmas-little-ghost"
  | "christmas-santa-workshop"
  | "christmas-first-snow-post"
  | "christmas-snow-globe";

export type PolaroidThemeCatalogEntry = {
  id: PolaroidThemeId;
  category: PolaroidCategory;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
  enabled: boolean;
  seasonal: boolean;
  startAt?: string;
  endAt?: string;
  thumb: string;
  imageStyleEn: string;
  greetingKo: string;
  greetingEn: string;
  memoMomentKo: string;
  memoMomentEn: string;
};

function envFlag(...names: string[]): boolean {
  return names.some((name) => process.env[name]?.trim().toLowerCase() === "true");
}

export function isYearRoundPolaroidEnabled(): boolean {
  return envFlag("SOUL_TRACE_POLAROID_YEARROUND_ENABLED", "NEXT_PUBLIC_POLAROID_YEARROUND_ENABLED");
}

export function isChristmasPolaroidEnabled(): boolean {
  return envFlag("SOUL_TRACE_POLAROID_SEASON_CHRISTMAS_ENABLED", "NEXT_PUBLIC_POLAROID_SEASON_CHRISTMAS_ENABLED");
}

export function isPolaroidArtAllEnabled(): boolean {
  return envFlag("SOUL_TRACE_POLAROID_ART_ALL", "NEXT_PUBLIC_POLAROID_ART_ALL");
}

export const POLAROID_THEME_CATALOG: readonly PolaroidThemeCatalogEntry[] = [
  {
    id: "halloween",
    category: "seasonal",
    titleKo: "호박마을의 밤",
    titleEn: "Pumpkin Village Night",
    hintKo: "기존 할로윈 폴라로이드",
    hintEn: "The original Halloween Polaroid",
    enabled: true,
    seasonal: true,
    thumb: "/images/halloween/card-4-pumpkin-cat-clean.png",
    imageStyleEn: "Create one realistic, emotionally natural Halloween photograph of the exact individual pet in the supplied reference image(s).",
    greetingKo: "해피 할로윈",
    greetingEn: "happy Halloween",
    memoMomentKo: "포근한 할로윈 밤",
    memoMomentEn: "Halloween",
  },
  {
    id: "felt-doll",
    category: "art-style",
    titleKo: "펠트풍",
    titleEn: "Felt",
    hintKo: "부드러운 양모 섬유와 수공예 인형 질감",
    hintEn: "Soft wool fibers and handmade doll texture",
    enabled: true,
    seasonal: false,
    thumb: "/images/polaroid/style-felt.jpg",
    imageStyleEn: "Create one square studio photograph of a handmade needle-felted wool miniature of the exact individual pet. The pet AND every background object — trees, clouds, furniture, books, toys — are physical wool-felt sculptures with visible fibers, rounded stuffed forms, and needle-punched texture. Warm craft-table lighting. This is a photographed needle-felt diorama, never a live animal, never a photo with a fur filter, never gouache, never crayon, and never an oil painting. Do not draw a collar, leash, harness, tag, bandana, scarf, or any neck accessory — bare neck only unless an explicit costume was selected.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "포근한 인형 세상",
    memoMomentEn: "this cozy felt day",
  },
  {
    id: "gouache-story",
    category: "art-style",
    titleKo: "과슈풍",
    titleEn: "Gouache",
    hintKo: "선명한 2D 과슈 그림",
    hintEn: "Clear 2D gouache illustration",
    enabled: true,
    seasonal: false,
    thumb: "/images/polaroid/style-gouache.jpg",
    imageStyleEn: "Create one square 2D gouache storybook illustration of the exact individual pet. Opaque gouache paint, natural visible brushstrokes, rich flowers and trees, warm picture-book color, and clean flat shapes. This is SoulTrace's original painted 2D fairy-tale look — not needle felt, not oil impasto, not a photograph, and not a child's crayon drawing. Do not draw a collar, leash, harness, tag, bandana, scarf, or any neck accessory — bare neck only unless an explicit costume was selected.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "그림책 같은 하루",
    memoMomentEn: "this storybook day",
  },
  {
    id: "paper-collage",
    category: "art-style",
    titleKo: "종이 콜라주",
    titleEn: "Paper Collage",
    hintKo: "색종이와 종이 공예로 구성한 장면",
    hintEn: "Colored paper and handmade collage",
    enabled: true,
    seasonal: false,
    thumb: "/images/art/cat-window.png",
    imageStyleEn: "Create one square paper-craft collage of the exact individual pet. Cut colored paper, layered paper edges, and handmade collage texture. Keep the pet's face readable. No photorealism.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "종이로 만든 작은 하루",
    memoMomentEn: "this paper-craft day",
  },
  {
    id: "starlight-oil",
    category: "art-style",
    titleKo: "별빛 유화",
    titleEn: "Starlight Oil",
    hintKo: "별빛과 회화적 붓결을 강조한 유화 스타일",
    hintEn: "Painterly brushwork under starlight",
    enabled: true,
    seasonal: false,
    thumb: "/images/art/memorial-night-hero-clean.png",
    imageStyleEn: "Create one square oil painting of the exact individual pet under starlight. Visible brushstrokes, painterly night light, and a glowing sky. Not a photograph and not a 3D render.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "별빛 아래 하루",
    memoMomentEn: "this starlit night",
  },
  {
    id: "miniature-world",
    category: "art-style",
    titleKo: "미니어처 세상",
    titleEn: "Miniature World",
    hintKo: "실제 제작된 작은 디오라마처럼 보이는 장면",
    hintEn: "A tiny handmade diorama world",
    enabled: false,
    seasonal: false,
    thumb: "/images/art/corgi-autumn.png",
    imageStyleEn: "Create one square miniature-diorama photograph of the exact individual pet as a tiny handmade figure inside a crafted scale world. Tilt-shift scale, real miniature props, and shallow depth. Keep the pet's face readable.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "작은 세상 속 하루",
    memoMomentEn: "this tiny world",
  },
  {
    id: "crayon-diary",
    category: "art-style",
    titleKo: "파스텔빈티지",
    titleEn: "Pastel vintage",
    hintKo: "빛바랜 파스텔과 빈티지 포스터 질감",
    hintEn: "Faded pastel vintage poster texture",
    enabled: true,
    seasonal: false,
    thumb: "/images/polaroid/style-pastel-vintage.jpg",
    imageStyleEn: "Create one square pastel vintage travel-poster illustration of the exact individual pet. Crisp delicate outlines, restrained pastel color, flat color with refined shading on vintage paper. No watercolor bleed, no anime, no photographic texture, no child's crayon diary drawing, not refined gouache illustration, and not felt sculpture. Do not draw a collar, leash, harness, tag, bandana, scarf, or any neck accessory — bare neck only unless an explicit costume was selected.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "파스텔 빈티지 하루",
    memoMomentEn: "this pastel-vintage day",
  },
  {
    id: "christmas-little-ghost",
    category: "seasonal",
    titleKo: "크리스마스의 작은 유령",
    titleEn: "A Little Christmas Ghost",
    hintKo: "작은 유령과 함께하는 포근한 크리스마스 밤",
    hintEn: "A gentle Christmas night with a tiny ghost",
    enabled: false,
    seasonal: true,
    startAt: "2026-12-01T00:00:00+09:00",
    endAt: "2027-01-06T23:59:59+09:00",
    thumb: "/images/art/memorial-night-hero-clean.png",
    imageStyleEn: "Create one square image of the exact individual pet in a gentle Christmas night, meeting a small friendly ghost. Soft winter light, no horror, no graves, and no brand names.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "우리만의 크리스마스",
    memoMomentEn: "our little Christmas",
  },
  {
    id: "christmas-santa-workshop",
    category: "seasonal",
    titleKo: "산타의 비밀 작업실",
    titleEn: "Santa's Secret Workshop",
    hintKo: "장난감과 리본이 있는 따뜻한 작업실",
    hintEn: "A warm workshop of toys and ribbons",
    enabled: false,
    seasonal: true,
    startAt: "2026-12-01T00:00:00+09:00",
    endAt: "2027-01-06T23:59:59+09:00",
    thumb: "/images/art/memorial-night-hero-clean.png",
    imageStyleEn: "Create one square image of the exact individual pet inside a cozy toy workshop. Wooden benches, ribbons, wrapped gifts, warm lamp light. No brand names and no copyrighted Santa likeness.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "작업실의 따뜻한 밤",
    memoMomentEn: "this workshop night",
  },
  {
    id: "christmas-first-snow-post",
    category: "seasonal",
    titleKo: "첫눈의 우체국",
    titleEn: "First-Snow Post Office",
    hintKo: "첫눈을 따라 걷는 작은 우체국",
    hintEn: "A tiny post office after the first snow",
    enabled: false,
    seasonal: true,
    startAt: "2026-12-01T00:00:00+09:00",
    endAt: "2027-01-06T23:59:59+09:00",
    thumb: "/images/art/memorial-night-hero-clean.png",
    imageStyleEn: "Create one square image of the exact individual pet at a tiny snowy post office. Soft first snow, a small letter bag, warm window light. No brand names.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "첫눈이 예쁜 날",
    memoMomentEn: "this first-snow day",
  },
  {
    id: "christmas-snow-globe",
    category: "seasonal",
    titleKo: "스노우볼 속 하루",
    titleEn: "A Day in a Snow Globe",
    hintKo: "유리구 안에서 보내는 작은 겨울",
    hintEn: "A tiny winter inside a snow globe",
    enabled: false,
    seasonal: true,
    startAt: "2026-12-01T00:00:00+09:00",
    endAt: "2027-01-06T23:59:59+09:00",
    thumb: "/images/art/memorial-night-hero-clean.png",
    imageStyleEn: "Create one square image of the exact individual pet inside a handmade snow globe. Soft falling snow, a tiny village, glass-curved light. No brand names.",
    greetingKo: "",
    greetingEn: "",
    memoMomentKo: "스노우볼 속 하루",
    memoMomentEn: "this snow-globe day",
  },
] as const;

export const EVERYDAY_POLAROID_ART_STYLE_IDS = ["felt-doll", "gouache-story", "crayon-diary"] as const;
export type PolaroidArtStyleId = (typeof EVERYDAY_POLAROID_ART_STYLE_IDS)[number];
export type PolaroidArtStyleKey = "felt" | "gouache" | "crayon";

export const PLANNED_POLAROID_THEMES = [
  { id: "newyear-blessing", category: "seasonal" as const, titleKo: "복을 배달하는 작은 친구", titleEn: "A Little Blessing Courier", hintKo: "새해 인사를 전하는 포근한 하루", hintEn: "A cozy day delivering New Year blessings" },
  { id: "valentine-letter", category: "seasonal" as const, titleKo: "사랑의 편지 배달부", titleEn: "Valentine Letter Carrier", hintKo: "작은 편지를 전하는 달콤한 하루", hintEn: "A sweet day delivering a tiny love letter" },
  { id: "spring-secret-garden", category: "seasonal" as const, titleKo: "꽃잎을 따라간 비밀 정원", titleEn: "The Secret Petal Garden", hintKo: "꽃잎이 흩날리는 비밀 정원", hintEn: "A hidden garden of drifting petals" },
  { id: "summer-seaside", category: "seasonal" as const, titleKo: "한여름의 작은 바닷마을", titleEn: "A Tiny Midsummer Harbor", hintKo: "햇살과 바닷바람이 있는 작은 마을", hintEn: "A tiny harbor of sun and sea breeze" },
  { id: "halloween-mischief-ghost", category: "seasonal" as const, titleKo: "장난꾸러기 유령", titleEn: "A Mischief Ghost", hintKo: "장난기 가득한 작은 유령과 함께", hintEn: "A playful night with a tiny mischief ghost" },
  { id: "birthday-star", category: "seasonal" as const, titleKo: "오늘은 내가 주인공 — 생일", titleEn: "Today I Am the Star — Birthday", hintKo: "오늘만큼은 내가 주인공인 하루", hintEn: "A birthday where this child is the star" },
] as const;

export type PolaroidOccasionItem = {
  id: string;
  titleKo: string;
  titleEn: string;
  hintKo: string;
  hintEn: string;
  implemented: boolean;
};

export type PolaroidOccasionGroup = {
  id: string;
  titleKo: string;
  titleEn: string;
  items: readonly PolaroidOccasionItem[];
};

const ADOPTION_DAY_OCCASION: PolaroidOccasionItem = {
  id: "adoption-day",
  titleKo: "우리가 처음 만난 날 — 입양 기념일",
  titleEn: "The Day We First Met — Adoption Day",
  hintKo: "우리가 처음 만난 그날의 온기",
  hintEn: "The warmth of the day we first met",
  implemented: true,
};

/**
 * Signed-in polaroid special days match the home free-trial plates,
 * plus birthday (already in the trial set) and adoption day.
 */
export const POLAROID_OCCASION_GROUPS: readonly PolaroidOccasionGroup[] = [
  {
    id: "special-days",
    titleKo: "특별한 날",
    titleEn: "Special days",
    items: [
      { id: "christmas-village", titleKo: "크리스마스 빌리지", titleEn: "Christmas village", hintKo: "따뜻한 크리스마스 마을", hintEn: "A warm Christmas village", implemented: true },
      { id: "spring-picnic", titleKo: "봄 피크닉", titleEn: "Spring picnic", hintKo: "꽃과 피크닉이 있는 봄날", hintEn: "A spring day with flowers and a picnic", implemented: true },
      { id: "summer-beach", titleKo: "여름 해변 리조트", titleEn: "Summer beach resort", hintKo: "햇살과 바닷바람이 있는 해변", hintEn: "A sunny beach with a sea breeze", implemented: true },
      { id: "autumn-walk", titleKo: "가을 산책길", titleEn: "Autumn walk", hintKo: "낙엽이 깔린 가을 산책", hintEn: "An autumn walk among fallen leaves", implemented: true },
      { id: "birthday-room", titleKo: "생일 파티 룸", titleEn: "Birthday party room", hintKo: "오늘만큼은 내가 주인공인 생일", hintEn: "A birthday room where this pet is the star", implemented: true },
      { id: "first-snow-street", titleKo: "첫눈 오는 거리", titleEn: "First-snow street", hintKo: "첫눈이 내리는 포근한 거리", hintEn: "A cozy street in the first snow", implemented: true },
      ADOPTION_DAY_OCCASION,
    ],
  },
];

function plannedOccasion(id: (typeof PLANNED_POLAROID_THEMES)[number]["id"]): PolaroidOccasionItem {
  const item = PLANNED_POLAROID_THEMES.find((entry) => entry.id === id)!;
  return {
    id: item.id,
    titleKo: item.titleKo,
    titleEn: item.titleEn,
    hintKo: item.hintKo,
    hintEn: item.hintEn,
    implemented: false,
  };
}

export const POLAROID_OCCASION_SCENE_EN: Record<string, string> = {
  "christmas-village": "A warm Christmas village path with lit shop windows and decorated trees. Keep the supplied pet as the only subject on the open path. No brand names, no text, and no Polaroid frame.",
  "spring-picnic": "A spring picnic meadow with blossoms, a blanket, and soft daylight. Keep the supplied pet in the open meadow near the picnic clearing, paws off the food. No people, dates, text, or logos.",
  "summer-beach": "A sunny summer beach resort with dry sand, distant waves, and a lighthouse feeling. Keep the supplied pet on dry sand only, out of the water. No people, dates, text, or logos.",
  "autumn-walk": "A leaf-strewn autumn path beside a quiet lake and fence. Keep the supplied pet strolling or pausing on the path. No people, dates, text, or logos.",
  "birthday-room": "A warm birthday party room with soft festive colors and decorations kept safely away from the pet. Keep the supplied pet as the only subject on the open floor. Do not invent people, candles on the pet, age numbers, dates, written text, or memories. No logos.",
  "first-snow-street": "A cozy first-snow street with warm windows and soft snowfall on the path. Keep the supplied pet walking or pausing on the open street. No people, dates, text, or logos.",
  "adoption-day": "A quiet welcome-home keepsake for the pet's first day together, shown through a softly lit doorway or a calm, familiar home interior. Keep the supplied pet as the only subject; do not invent people, another pet, an adoption event, a shelter, paperwork, a date, or any detail not supplied. No text or logos.",
  // Legacy ids retained so older saved results still resolve a scene brief.
  halloween: "A cozy pumpkin-village night with warm lanterns and autumn leaves. Gentle Halloween mood only — no horror, no graves, and no Rainbow Bridge.",
  "birthday-star": "A warm, gentle birthday celebration centered on the supplied pet, with soft festive colors and simple paper garlands kept safely away from the pet. No people, candles, cake, age numbers, dates, written text, or invented memories. No logos.",
};

export function polaroidArtStyleKey(themeId: string): PolaroidArtStyleKey | null {
  if (themeId === "felt-doll") return "felt";
  if (themeId === "gouache-story") return "gouache";
  if (themeId === "crayon-diary") return "crayon";
  return null;
}

export function isEverydayPolaroidArtStyle(themeId: string): themeId is PolaroidArtStyleId {
  return (EVERYDAY_POLAROID_ART_STYLE_IDS as readonly string[]).includes(themeId);
}

export function polaroidOccasionItem(occasionId: string): PolaroidOccasionItem | undefined {
  return POLAROID_OCCASION_GROUPS.flatMap((group) => group.items).find((item) => item.id === occasionId);
}

const CATALOG_BY_ID = Object.fromEntries(POLAROID_THEME_CATALOG.map((entry) => [entry.id, entry])) as Record<PolaroidThemeId, PolaroidThemeCatalogEntry>;

export function polaroidThemeCatalogEntry(themeId: string): PolaroidThemeCatalogEntry | undefined {
  return Object.prototype.hasOwnProperty.call(CATALOG_BY_ID, themeId)
    ? CATALOG_BY_ID[themeId as PolaroidThemeId]
    : undefined;
}

export function isPolaroidThemeId(value: string): value is PolaroidThemeId {
  return Object.prototype.hasOwnProperty.call(CATALOG_BY_ID, value);
}

function themeEnvEnabled(themeId: string): boolean {
  const key = themeId.replace(/-/g, "_").toUpperCase();
  return envFlag(`SOUL_TRACE_POLAROID_THEME_${key}`, `NEXT_PUBLIC_POLAROID_THEME_${key}`);
}

export function isPolaroidThemeSelectable(
  themeId: string,
  now = Date.now(),
  flags: {
    yearRound?: boolean;
    christmas?: boolean;
    artAll?: boolean;
  } = {},
): boolean {
  const entry = polaroidThemeCatalogEntry(themeId);
  if (!entry) return false;
  if (entry.id === "halloween") return true;
  const yearRound = flags.yearRound ?? isYearRoundPolaroidEnabled();
  const christmas = flags.christmas ?? isChristmasPolaroidEnabled();
  const artAll = flags.artAll ?? isPolaroidArtAllEnabled();
  if (entry.category === "art-style") {
    if (isEverydayPolaroidArtStyle(entry.id)) return yearRound && (entry.enabled || themeEnvEnabled(entry.id));
    return artAll || themeEnvEnabled(entry.id);
  }
  if (entry.id.startsWith("christmas-")) {
    // Operator approval is required. Dates are stored for later public windows
    // and never auto-open a season on their own.
    void now;
    return christmas || entry.enabled || themeEnvEnabled(entry.id);
  }
  return entry.enabled || themeEnvEnabled(entry.id);
}

export function isPolaroidThemeAdmitted(themeId: string): boolean {
  return isPolaroidThemeId(themeId) && (themeId === "halloween" || isPolaroidThemeSelectable(themeId));
}

export function isPolaroidOccasionAdmitted(
  occasionId: string,
  flags?: { yearRound?: boolean; christmas?: boolean; artAll?: boolean },
): boolean {
  const item = polaroidOccasionItem(occasionId);
  if (!item?.implemented) return false;
  if ([
    "christmas-village",
    "spring-picnic",
    "summer-beach",
    "autumn-walk",
    "birthday-room",
    "first-snow-street",
    "adoption-day",
    "halloween",
    "birthday-star",
  ].includes(occasionId)) return true;
  return isPolaroidThemeSelectable(occasionId, Date.now(), flags);
}

export function everydayPolaroidArtStyles(
  flags?: { yearRound?: boolean; christmas?: boolean; artAll?: boolean },
): PolaroidThemeCatalogEntry[] {
  return EVERYDAY_POLAROID_ART_STYLE_IDS
    .map((id) => polaroidThemeCatalogEntry(id))
    .filter((entry): entry is PolaroidThemeCatalogEntry => entry !== undefined && isPolaroidThemeSelectable(entry.id, Date.now(), flags));
}

export function selectablePolaroidThemes(
  category?: PolaroidCategory,
  flags?: { yearRound?: boolean; christmas?: boolean; artAll?: boolean },
): PolaroidThemeCatalogEntry[] {
  return POLAROID_THEME_CATALOG.filter((entry) => {
    if (category && entry.category !== category) return false;
    return isPolaroidThemeSelectable(entry.id, Date.now(), flags);
  });
}

export function polaroidThemeTitle(entry: PolaroidThemeCatalogEntry | PolaroidThemeId | string, locale: "ko" | "en"): string {
  const resolved = typeof entry === "string" ? polaroidThemeCatalogEntry(entry) : entry;
  if (!resolved) return typeof entry === "string" ? entry : "";
  return locale === "ko" ? resolved.titleKo : resolved.titleEn;
}

export function polaroidThemeWithCatalog(theme: SeasonalPolaroidTheme): PolaroidThemeCatalogEntry | undefined {
  return polaroidThemeCatalogEntry(theme.id);
}
