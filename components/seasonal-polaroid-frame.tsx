"use client";

/* eslint-disable @next/next/no-img-element -- private result images and the stable template are rasterized in-browser. */

import type { Locale } from "@/lib/i18n";
import { useLayoutEffect, useRef, useState, type RefObject, type ReactNode } from "react";

/**
 * The template's flower clusters reach into the caption band from both sides,
 * narrowing the clear area from about 56% of the frame width at the top to
 * 42% at the bottom (measured pixel by pixel on the 1024×1536 template).
 * These float shapes trace that edge, with a ~1% safety margin, so centred
 * caption lines shorten beside a petal instead of overlapping it. The window
 * starts just under the paw ornament (70.3%) and the narrow step sits below
 * the fourth line box, so four maximum-length lines never wrap; a fifth,
 * wrapped line still fits above the SOUL TRACE divider (81.3%).
 */
/** Base caption size: 2.5% of the frame width, the largest that fits four maximum-length lines. */
export const CAPTION_FONT_SIZE = "2.5cqw";
const CAPTION_FIT_STEP = 0.05;
/**
 * Readability floor: a line may shrink to 80% of the base size (7 px on a
 * 350 px phone card, 8.6 px on the result page) and no further. A greeting
 * that still does not fit is split onto two explicit lines instead.
 */
export const CAPTION_FIT_MIN = 0.8;

/**
 * Split an over-long greeting at a natural boundary: after the first comma
 * (the owner's call name), otherwise at the space nearest the middle.
 */
export function splitCaptionGreeting(greeting: string): [string, string] | null {
  const text = greeting.trim();
  const comma = text.indexOf(", ");
  if (comma > 0 && comma < text.length - 2) return [text.slice(0, comma + 1), text.slice(comma + 2)];
  const spaces = [...text.matchAll(/ /g)].map((match) => match.index!);
  if (!spaces.length) return null;
  const middle = spaces.reduce((best, index) => Math.abs(index - text.length / 2) < Math.abs(best - text.length / 2) ? index : best, spaces[0]!);
  return [text.slice(0, middle), text.slice(middle + 1)];
}

function visualLineCount(paragraph: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  return Array.from(range.getClientRects()).filter((rect) => rect.width > 0).length;
}

/**
 * Every caption line must stay a single line on every surface. Glyph advances
 * are rounded to device pixels on screen but exact in the SVG capture used
 * for the PNG, so a line that is a hair too wide could wrap on screen and not
 * in the file. This measures each paragraph as laid out (floats included) and
 * steps its size down, as a multiple of the container-relative base size, until
 * it fits on one line or reaches the readability floor. The export copies the
 * computed size, so screen and file always share one structure.
 *
 * Returns true when every paragraph fits on one line.
 */
export function fitCaptionLines(memo: HTMLElement): boolean {
  let allFit = true;
  for (const paragraph of Array.from(memo.querySelectorAll<HTMLElement>("p"))) {
    paragraph.style.fontSize = "";
    let factor = 1;
    while (factor > CAPTION_FIT_MIN + 1e-9 && visualLineCount(paragraph) > 1) {
      factor = Math.round((factor - CAPTION_FIT_STEP) * 100) / 100;
      paragraph.style.fontSize = `calc(${CAPTION_FONT_SIZE} * ${factor})`;
    }
    if (visualLineCount(paragraph) > 1) allFit = false;
  }
  return allFit;
}

/** Caption lines as rendered: the greeting may be split onto two explicit lines. */
export function captionDisplayLines(memoLines: string[], greetingSplit: boolean): string[] {
  const lines = memoLines.slice(0, 4);
  if (!greetingSplit || !lines[0]) return lines;
  const split = splitCaptionGreeting(lines[0]);
  return split ? [split[0], split[1], ...lines.slice(1)] : lines;
}

export const CAPTION_LEFT_FLOWER_SHAPE = "[shape-outside:polygon(0_0,30%_0,30%_37%,52%_43%,52%_70%,100%_72%,100%_100%,0_100%)]";
export const CAPTION_RIGHT_FLOWER_SHAPE = "[shape-outside:polygon(18%_0,100%_0,100%_100%,0_100%,0_72%,48%_70%,48%_43%,70%_37%,70%_13%,18%_13%)]";

type SeasonalPolaroidFrameProps = {
  polaroidRef?: RefObject<HTMLDivElement | null>;
  lang: Locale;
  t: (path: string) => string;
  imageUrl: string | null;
  imageAlt?: string;
  onImageError?: () => void;
  memoLines: string[];
  showMemo: boolean;
  placeholder: boolean;
  className?: string;
  imageFallback?: ReactNode;
  /** Small label under the caption window (development mock only). */
  badge?: ReactNode;
};

/**
 * Root presentation shared by the result page and the gallery. Only this
 * class list and `SEASONAL_POLAROID_FRAME_TILT_CLASS` differ between the
 * surfaces: the result page adds the tilt and shadow, which the export
 * strips, so every surface rasterises to the same composition.
 */
export const SEASONAL_POLAROID_FRAME_BASE_CLASS = "relative aspect-[2/3] w-full overflow-hidden bg-[#F2E8D7] text-[#49372A]";
export const SEASONAL_POLAROID_FRAME_TILT_CLASS = "rotate-[-1deg] rounded-[3px] shadow-[0_28px_60px_rgba(0,0,0,0.58)] transition-transform duration-700 hover:rotate-0 motion-reduce:transform-none";

/**
 * The single source of truth for the Seasonal Polaroid composition.
 * Keeping the template, photo window, and memo geometry together ensures the
 * result page and My Polaroids gallery render the same artwork.
 */
export function SeasonalPolaroidFrame({
  polaroidRef,
  lang,
  t,
  imageUrl,
  imageAlt,
  onImageError,
  memoLines,
  showMemo,
  placeholder,
  className,
  imageFallback,
  badge,
}: SeasonalPolaroidFrameProps) {
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const frameClassName = className ?? `${SEASONAL_POLAROID_FRAME_BASE_CLASS} ${SEASONAL_POLAROID_FRAME_TILT_CLASS}`;
  const memoRef = useRef<HTMLDivElement>(null);
  const memoKey = memoLines.join("\n");
  // The split decision belongs to one caption: a new caption starts unsplit.
  const [split, setSplit] = useState<{ key: string; value: boolean }>({ key: memoKey, value: false });
  const greetingSplit = split.key === memoKey && split.value;
  useLayoutEffect(() => {
    if (!showMemo || !memoRef.current) return;
    const memo = memoRef.current;
    const fit = () => {
      // At the readability floor a greeting may still be too long; give it a second line.
      if (!fitCaptionLines(memo) && !greetingSplit && splitCaptionGreeting(memoLines[0] ?? "")) setSplit({ key: memoKey, value: true });
    };
    fit();
    if (typeof document !== "undefined" && document.fonts?.ready) {
      // Web fonts may land after first layout; refit once they have.
      void document.fonts.ready.then(fit);
    }
  }, [showMemo, memoKey, memoLines, lang, greetingSplit]);
  const displayLines = captionDisplayLines(memoLines, greetingSplit);

  return (
    <div ref={polaroidRef} className={`@container ${frameClassName}`}>
      <img data-seasonal-polaroid="template" src="/images/soul_trace_seasonal_polaroid_blank_caption_template.png" alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-fill" />
      <div data-seasonal-polaroid="photo-window" className="absolute left-[16.2%] top-[15.2%] z-10 h-[50.7%] w-[67.8%] overflow-hidden rounded-[4%] bg-[#E9E1D7] shadow-[inset_0_0_18px_rgba(53,38,26,0.18)]">
        {imageUrl && !placeholder ? <img data-seasonal-polaroid="photo" src={imageUrl} alt={imageAlt ?? t("polaroidPreviewAlt")} onError={onImageError} className="h-full w-full object-cover object-center" /> : imageFallback ?? null}
        <div className={`absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(145deg,rgba(30,12,38,0.42),rgba(117,43,20,0.42))] px-7 text-center transition-opacity duration-1000 ${placeholder ? "opacity-100" : "opacity-0"}`}>
          <span className="text-4xl" aria-hidden="true">🎃</span>
          <p className={`mt-4 text-xs leading-6 text-[#F5D999] ${bodyFont}`}>{t("seasonalPolaroid.generation.developingPhoto")}</p>
        </div>
        <span className="absolute right-4 top-4 text-2xl text-[#F7D47D]" aria-hidden="true">✦</span>
      </div>
      <div data-seasonal-polaroid="caption" className="absolute bottom-[19%] left-[19%] right-[19%] top-[70.6%] z-20 overflow-hidden text-center">
        {showMemo ? (
          <>
            <span aria-hidden="true" className={`float-left h-full w-[18%] ${CAPTION_LEFT_FLOWER_SHAPE}`} />
            <span aria-hidden="true" className={`float-right h-full w-[18%] ${CAPTION_RIGHT_FLOWER_SHAPE}`} />
            <div ref={memoRef} className={`text-[2.5cqw] leading-[1.1] ${bodyFont}`}>
              {displayLines.map((line, index) => <p key={`${index}-${line.slice(0, 8)}`} className="break-words">{line}</p>)}
            </div>
          </>
        ) : (
          <p className={`flex h-full items-center justify-center text-sm text-[#806A56]/75 ${bodyFont}`}>{t("seasonalPolaroid.generation.memoWaiting")}</p>
        )}
      </div>
      {badge ? <p className="absolute bottom-[14%] left-0 right-0 z-20 text-center font-display-en text-[8px] uppercase tracking-[0.28em] text-[#806A56]">{badge}</p> : null}
    </div>
  );
}
