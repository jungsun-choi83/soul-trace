/* eslint-disable @next/next/no-img-element -- private result images and the stable template are rasterized in-browser. */

import type { Locale } from "@/lib/i18n";
import type { RefObject, ReactNode } from "react";

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
};

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
}: SeasonalPolaroidFrameProps) {
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const frameClassName = className ?? "relative aspect-[2/3] w-full overflow-hidden rotate-[-1deg] rounded-[3px] bg-[#F2E8D7] text-[#49372A] shadow-[0_28px_60px_rgba(0,0,0,0.58)] transition-transform duration-700 hover:rotate-0 motion-reduce:transform-none";

  return (
    <div ref={polaroidRef} className={frameClassName}>
      <img src="/images/soul_trace_seasonal_polaroid_blank_caption_template.png" alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-fill" />
      <div className="absolute left-[16.2%] top-[15.2%] z-10 h-[50.7%] w-[67.8%] overflow-hidden rounded-[4%] bg-[#E9E1D7] shadow-[inset_0_0_18px_rgba(53,38,26,0.18)]">
        {imageUrl && !placeholder ? <img src={imageUrl} alt={imageAlt ?? t("polaroidPreviewAlt")} onError={onImageError} className="h-full w-full object-cover object-center" /> : imageFallback ?? null}
        <div className={`absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(145deg,rgba(30,12,38,0.42),rgba(117,43,20,0.42))] px-7 text-center transition-opacity duration-1000 ${placeholder ? "opacity-100" : "opacity-0"}`}>
          <span className="text-4xl" aria-hidden="true">🎃</span>
          <p className={`mt-4 text-xs leading-6 text-[#F5D999] ${bodyFont}`}>{t("seasonalPolaroid.generation.developingPhoto")}</p>
        </div>
        <span className="absolute right-4 top-4 text-2xl text-[#F7D47D]" aria-hidden="true">✦</span>
      </div>
      <div className="absolute bottom-[18%] left-[22%] right-[22%] top-[71.5%] z-20 flex items-center justify-center overflow-hidden px-1 text-center">
        {showMemo ? (
          <div className={`max-w-full text-[clamp(0.42rem,1.55vw,0.68rem)] leading-[1.15] ${bodyFont}`}>
            {memoLines.slice(0, 4).map((line, index) => <p key={`${index}-${line.slice(0, 8)}`} className="break-words [text-wrap:balance]">{line}</p>)}
          </div>
        ) : (
          <p className={`text-sm text-[#806A56]/75 ${bodyFont}`}>{t("seasonalPolaroid.generation.memoWaiting")}</p>
        )}
      </div>
    </div>
  );
}
