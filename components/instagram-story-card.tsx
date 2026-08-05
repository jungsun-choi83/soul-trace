"use client";

import type { Locale } from "@/lib/i18n";
import { forwardRef } from "react";

export type InstagramStoryCardProps = {
  heroSrc: string | null;
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
      heroSrc,
      nameLead,
      personalityTitle,
      emotionalLine,
      footerTagline,
      siteLine,
      lang,
    },
    ref,
  ) {
    const quoteFont = lang === "ko" ? "font-ko" : "font-display-en";

    return (
      <div
        ref={ref}
        className={`relative flex h-[1920px] w-[1080px] flex-col overflow-hidden bg-[#0f1012] ${quoteFont}`}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(255,255,255,0.08),rgba(255,255,255,0)_42%),radial-gradient(circle_at_82%_84%,rgba(212,175,55,0.08),rgba(212,175,55,0)_40%),linear-gradient(145deg,#0f1012,#17191d_52%,#101215)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.75)_1px,transparent_0)] [background-size:3px_3px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/55" />

        {/* 상단 일러스트 — 절반 높이로 고정해 하단 텍스트 영역 확보 */}
        <div className="relative z-[1] h-[960px] w-full shrink-0">
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- 캡처용 정적 카드
            <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.38]" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#26282d] via-[#16181b] to-[#0f1012]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f1012] via-[#0f1012]/75 to-transparent" />
        </div>

        {/* 하단 텍스트 패널 — flex 밀림 없이 이름·맺음말·워터마크 고정 */}
        <div
          className={`relative z-10 flex min-h-[960px] w-full flex-1 flex-col bg-[#0f1012] px-12 pb-44 pt-12 text-center ${quoteFont}`}
        >
          <p className="font-display-en text-[30px] font-light tracking-[0.28em] text-[#D8C298]/80">
            SOUL TRACE
          </p>

          <p className="mt-8 text-[40px] font-light leading-[1.35] tracking-[0.02em] text-[#E8CF9A]">
            {nameLead}
          </p>

          <p
            className={`instagram-story-quote-clamp mx-auto mt-10 max-w-[980px] text-[46px] font-extralight leading-[1.42] text-[#F2E7D1] ${
              lang === "ko" ? "break-keep" : ""
            }`}
            style={{ textShadow: "0 6px 28px rgba(0,0,0,0.65)" }}
          >
            “{emotionalLine}”
          </p>

          <p className="mt-auto pt-10 text-[22px] font-light tracking-[0.18em] text-[#C4BBB0]/55">
            {personalityTitle}
          </p>
          <p className="mt-4 text-[18px] font-light leading-relaxed tracking-[0.12em] text-[#B8A896]/62">
            {footerTagline}
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-10 pb-16 pt-8">
          <span className="rounded-full border border-white/18 bg-black/55 px-10 py-3.5 text-center font-display-en text-[24px] font-semibold tracking-[0.2em] text-white/50 shadow-[0_2px_24px_rgba(0,0,0,0.65)]">
            {siteLine}
          </span>
        </div>
      </div>
    );
  },
);
