export type LetterThemeId = "golden-meadow" | "night-sky" | "soft-clouds" | "memory-paper";

export type LetterTheme = {
  id: LetterThemeId;
  nameKey: string;
  backgroundImage: string;
  fallbackBackground: string;
  fontFamily: string;
  textColor: string;
  overlayColor: string;
  headingColor: string;
  dropCapColor: string;
  panelBorderColor: string;
  cardBackground: string;
  dividerColor: string;
  stampAccentColor: string;
  stampInkColor: string;
  endingColor: string;
};

/**
 * Generated-letter preview themes. Values here are intentionally independent of
 * the application shell; applying a theme must never mutate the page background.
 */
export const LETTER_THEMES: readonly LetterTheme[] = [
  {
    id: "golden-meadow",
    nameKey: "result.letterStyle.goldenMeadow",
    backgroundImage: "/backgrounds/golden-meadow.jpg",
    fallbackBackground:
      "linear-gradient(145deg, #d8b96d 0%, #eee0ac 43%, #a8863e 100%)",
    fontFamily: "var(--font-playfair), var(--font-noto-serif-kr), serif",
    textColor: "#3f2d20",
    overlayColor: "rgba(255, 249, 229, 0.88)",
    headingColor: "#9a7426",
    dropCapColor: "#9a7426",
    panelBorderColor: "rgba(154, 116, 38, 0.34)",
    cardBackground: "radial-gradient(circle at 15% 12%, rgba(255,255,255,0.82), transparent 27%), repeating-linear-gradient(0deg, rgba(96,66,31,0.025) 0 1px, transparent 1px 4px), linear-gradient(145deg, #fffaf0 0%, #f7ecd5 58%, #edddbd 100%)",
    dividerColor: "rgba(154, 113, 52, 0.25)",
    stampAccentColor: "#a77c3d",
    stampInkColor: "#775f48",
    endingColor: "#9a7134",
  },
  {
    id: "night-sky",
    nameKey: "result.letterStyle.nightSky",
    backgroundImage: "/backgrounds/night-sky.jpg",
    fallbackBackground:
      "radial-gradient(circle at 25% 18%, rgba(219,226,255,0.24) 0 1px, transparent 2px), linear-gradient(160deg, #17213b 0%, #263354 48%, #0c1224 100%)",
    fontFamily: "var(--font-cormorant), var(--font-noto-serif-kr), serif",
    textColor: "#f3ead8",
    overlayColor: "rgba(10, 18, 39, 0.86)",
    headingColor: "#d0ad62",
    dropCapColor: "#d0ad62",
    panelBorderColor: "rgba(208, 173, 98, 0.34)",
    cardBackground: "radial-gradient(circle at 18% 10%, rgba(52,72,118,0.72), transparent 32%), repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 4px), linear-gradient(150deg, #192744 0%, #101a31 62%, #091123 100%)",
    dividerColor: "rgba(208, 173, 98, 0.34)",
    stampAccentColor: "#d0ad62",
    stampInkColor: "#c49b50",
    endingColor: "#dfbd70",
  },
  {
    id: "soft-clouds",
    nameKey: "result.letterStyle.softClouds",
    backgroundImage: "/backgrounds/soft-clouds.jpg",
    fallbackBackground:
      "radial-gradient(ellipse at 25% 28%, #fffdf7 0 16%, transparent 17%), radial-gradient(ellipse at 70% 55%, #f8fbff 0 22%, transparent 23%), linear-gradient(150deg, #dbe8f1 0%, #f6efe1 100%)",
    fontFamily: "var(--font-inter), var(--font-noto-serif-kr), sans-serif",
    textColor: "#34383d",
    overlayColor: "rgba(255, 255, 255, 0.84)",
    headingColor: "#9a7b38",
    dropCapColor: "#9a7b38",
    panelBorderColor: "rgba(154, 123, 56, 0.28)",
    cardBackground: "radial-gradient(circle at 20% 12%, rgba(255,255,255,0.95), transparent 30%), linear-gradient(145deg, #fffefa 0%, #f2f5f4 55%, #e5edf0 100%)",
    dividerColor: "rgba(154, 123, 56, 0.22)",
    stampAccentColor: "#a58a50",
    stampInkColor: "#71808a",
    endingColor: "#967631",
  },
  {
    id: "memory-paper",
    nameKey: "result.letterStyle.memoryPaper",
    backgroundImage: "/backgrounds/memory-paper.jpg",
    fallbackBackground:
      "repeating-linear-gradient(0deg, rgba(92,65,37,0.035) 0 1px, transparent 1px 4px), linear-gradient(145deg, #d8c6a5 0%, #f0e5cf 48%, #cbb48d 100%)",
    fontFamily: "var(--font-courier-prime), var(--font-noto-serif-kr), monospace",
    textColor: "#493625",
    overlayColor: "rgba(244, 232, 207, 0.88)",
    headingColor: "#9a742f",
    dropCapColor: "#8d6429",
    panelBorderColor: "rgba(112, 78, 42, 0.3)",
    cardBackground: "repeating-linear-gradient(0deg, rgba(92,65,37,0.04) 0 1px, transparent 1px 4px), linear-gradient(145deg, #f5ead3 0%, #e9d7b7 58%, #dbc29a 100%)",
    dividerColor: "rgba(112, 78, 42, 0.28)",
    stampAccentColor: "#936b35",
    stampInkColor: "#71563b",
    endingColor: "#8d6429",
  },
] as const;

export const DEFAULT_LETTER_THEME_ID: LetterThemeId = "golden-meadow";

export function isLetterThemeId(value: unknown): value is LetterThemeId {
  return LETTER_THEMES.some((theme) => theme.id === value);
}

export function getLetterTheme(id: LetterThemeId): LetterTheme {
  return LETTER_THEMES.find((theme) => theme.id === id) ?? LETTER_THEMES[0];
}
