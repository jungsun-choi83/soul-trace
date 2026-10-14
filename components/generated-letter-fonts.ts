import { Allura, Caveat, Gowun_Dodum } from "next/font/google";
import localFont from "next/font/local";
import type { Locale } from "@/lib/i18n";
import type { LetterMode } from "@/lib/letter-mode";

export const englishLetterBodyFont = Caveat({
  variable: "--font-letter-en-body",
  subsets: ["latin"],
  display: "swap",
});

export const englishLetterOpeningFont = Allura({
  variable: "--font-letter-en-opening",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const koreanLetterFont = localFont({
  src: "../public/fonts/UnPen.ttf",
  variable: "--font-letter-ko",
  weight: "400",
  style: "normal",
  display: "swap",
  fallback: ["Noto Serif KR", "Nanum Myeongjo", "serif"],
});

/** Living letters: rounded gothic close to Seoul Namsan, not myeongjo. */
export const koreanLivingLetterFont = Gowun_Dodum({
  variable: "--font-letter-ko-living",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const LIVING_KOREAN_LETTER_STACK =
  "var(--font-letter-ko-living), 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MEMORIAL_KOREAN_LETTER_STACK =
  "var(--font-letter-ko), var(--font-noto-serif-kr), var(--font-nanum-myeongjo), serif";

export function koreanLetterFontStack(mode: LetterMode): string {
  return mode === "living" ? LIVING_KOREAN_LETTER_STACK : MEMORIAL_KOREAN_LETTER_STACK;
}

export function letterBodyFontFamily(locale: Locale, mode: LetterMode): string {
  if (locale !== "ko") {
    return "var(--font-letter-en-body), 'Segoe Print', 'Bradley Hand', cursive";
  }
  return koreanLetterFontStack(mode);
}

export function letterOpeningFontFamily(locale: Locale, mode: LetterMode): string {
  if (locale !== "ko") {
    return "var(--font-letter-en-opening), var(--font-letter-en-body), 'Segoe Script', cursive";
  }
  return koreanLetterFontStack(mode);
}
