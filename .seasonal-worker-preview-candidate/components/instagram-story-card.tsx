"use client";

import type { Locale } from "@/lib/i18n";
import type { LetterTheme } from "@/lib/letter-themes";
import { forwardRef } from "react";

export type InstagramStoryCardProps = {
  theme: LetterTheme;
  backgroundImageReady: boolean;
  /** 설문에 적은 이름 포함 맺음말 머리말 (예: "코코가 전하는 맺음말") */
  nameLead: string;
  personalityTitle: string;
  emotionalLine: string;
  footerTagline: string;
  siteLine: string;
  lang: Locale;
};

/**
 * 인스타 스토리 9:16 바이럴 카드 — html-to-image 캡처 전용(화면 밖 배치).
 * 상단 일러스트 / 하단 고정 텍스트 패널(이름·인용·워터마크가 잘리지 않도록 분리).
 */
export const InstagramStoryCard = forwardRef<HTMLDivElement, InstagramStoryCardProps>(
  function InstagramStoryCard(
    {
      theme,
      backgroundImageReady,
      nameLead,
      personalityTitle,
      emotionalLine,
      footerTagline,
      siteLine,
      lang,
    },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className="relative flex h-[1920px] w-[1080px] flex-col overflow-hidden"
        style={{
          background: theme.fallbackBackground,
          color: theme.textColor,
          fontFamily: theme.fontFamily,
        }}
        aria-hidden
      >
        {backgroundImageReady ? (
          // eslint-disable-next-line @next/next/no-img-element -- exact public theme asset in capture-only card
          <img
            src={theme.backgroundImage}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        <div className="relative z-[1] h-[760px] w-full shrink-0" />

        <div
          className="relative z-10 mx-12 mb-28 flex min-h-[1020px] flex-1 flex-col rounded-[42px] border px-12 pb-32 pt-14 text-center shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-xl"
          style={{
            backgroundColor: theme.overlayColor,
            borderColor: theme.panelBorderColor,
          }}
        >
          <p className="text-[30px] font-semibold tracking-[0.2em]" style={{ color: theme.headingColor }}>
            SOUL TRACE
          </p>

          <p className="mt-8 text-[40px] font-semibold leading-[1.35] tracking-[0.02em]" style={{ color: theme.headingColor }}>
            {nameLead}
          </p>

          <p
            className={`instagram-story-quote-clamp mx-auto mt-10 max-w-[900px] text-[46px] font-normal leading-[1.5] tracking-normal ${
              lang === "ko" ? "break-keep" : ""
            }`}
          >
            “{emotionalLine}”
          </p>

          <p className="mt-auto pt-10 text-[22px] font-semibold tracking-[0.1em] opacity-65">
            {personalityTitle}
          </p>
          <p className="mt-4 text-[18px] font-normal leading-relaxed tracking-[0.08em] opacity-60">
            {footerTagline}
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-10 pb-16 pt-8">
          <span className="rounded-full border border-white/18 bg-black/55 px-10 py-3.5 text-center text-[24px] font-semibold tracking-[0.18em] text-white/70 shadow-[0_2px_24px_rgba(0,0,0,0.65)]">
            {siteLine}
          </span>
        </div>
      </div>
    );
  },
);
