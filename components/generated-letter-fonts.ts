import { Allura, Caveat } from "next/font/google";
import localFont from "next/font/local";

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
