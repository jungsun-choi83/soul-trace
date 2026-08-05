"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

/** 소개 영상(정적). 상단 결과 카드 배경(DALL·E)과는 별도 */
const PREVIEW_DEVICE_VIDEO = "/videos/unsounded-play.mp4";

type EternalBeamPreviewProps = {
  lang: Locale;
};

/**
 * 이터널빔 소개 — 가로 풀 너비 영상 + 하단 카피. 상단 히어로 생성 배경과 무관.
 */
export function EternalBeamPreview({ lang }: EternalBeamPreviewProps) {
  const { t } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  return (
    <section
      className={`mx-auto mt-10 max-w-xl rounded-2xl border border-[rgba(212,175,55,0.28)] bg-[rgba(12,10,8,0.65)] px-5 py-8 shadow-[inset_0_1px_0_rgba(255,248,220,0.04)] sm:px-7 sm:py-9 ${bodyFont}`}
      aria-labelledby="eternal-beam-preview-title"
    >
      <h2
        id="eternal-beam-preview-title"
        className="text-center text-[10px] font-light uppercase tracking-[0.32em] text-[#D4AF37]/95 sm:text-xs"
      >
        {t("result.eternalBeamPreview.kicker")}
      </h2>

      {/* 패딩 상쇄: 카드 내 가로 풀 너비 · 16:9 */}
      <div className="relative mt-7 -mx-5 aspect-video w-[calc(100%+2.5rem)] overflow-hidden rounded-xl border border-[rgba(212,175,55,0.22)] bg-black shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:-mx-7 sm:w-[calc(100%+3.5rem)]">
        <video
          className="h-full w-full object-cover object-center"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
          aria-hidden
        >
          <source src={PREVIEW_DEVICE_VIDEO} type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>

      <p className="mx-auto mt-6 max-w-md text-center text-sm font-extralight leading-relaxed text-[#E8DCC8] sm:text-[15px]">
        {t("result.eternalBeamPreview.body")}
      </p>
    </section>
  );
}
