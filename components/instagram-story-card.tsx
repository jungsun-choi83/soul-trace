"use client";

import { LetterPostageStamp } from "@/components/letter-postage-stamp";
import type { Locale } from "@/lib/i18n";
import type { LetterTheme } from "@/lib/letter-themes";
import type { DefaultStampType } from "@/lib/stamp";
import { forwardRef } from "react";

export type InstagramStoryCardProps = {
  theme: LetterTheme;
  backgroundImageReady: boolean;
  letterOpening: string;
  letterBody: string;
  letterLanguage: Locale;
  signatureDate: string;
  signatureName: string;
  photoUrl: string | null;
  defaultStamp: DefaultStampType;
  bodyFontFamily: string;
  openingFontFamily: string;
  siteLine: string;
};

/** Full-letter 9:16 artwork used only for Instagram capture. */
export const InstagramStoryCard = forwardRef<HTMLDivElement, InstagramStoryCardProps>(
  function InstagramStoryCard(
    {
      theme,
      backgroundImageReady,
      letterOpening,
      letterBody,
      letterLanguage,
      signatureDate,
      signatureName,
      photoUrl,
      defaultStamp,
      bodyFontFamily,
      openingFontFamily,
      siteLine,
    },
    ref,
  ) {
    const characterCount = `${letterOpening}\n${letterBody}`.length;
    const bodyFontSize = characterCount > 2500 ? 27 : characterCount > 1800 ? 31 : 36;
    const bodyLineHeight = characterCount > 2500 ? 1.5 : 1.62;
    const openingFontSize = letterLanguage === "ko" ? 42 : 54;
    const paragraphs = letterBody;

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
          // eslint-disable-next-line @next/next/no-img-element -- exact public theme asset in capture-only artwork
          <img
            src={theme.backgroundImage}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        <article
          className="relative z-10 mx-12 my-12 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[42px] border px-20 pb-24 pt-44 shadow-[0_24px_70px_rgba(8,10,20,0.34),inset_0_0_70px_rgba(130,91,35,0.06)]"
          style={{
            background: theme.cardBackground,
            borderColor: theme.panelBorderColor,
          }}
        >
          <div
            className="absolute inset-x-16 top-12 h-px"
            style={{ background: `linear-gradient(to right, transparent, ${theme.dividerColor}, transparent)` }}
          />
          <LetterPostageStamp
            photoUrl={photoUrl}
            defaultStamp={defaultStamp}
            accentColor={theme.stampAccentColor}
            inkColor={theme.stampInkColor}
          />

          <div
            data-story-letter-body
            className={`min-h-0 flex-1 whitespace-pre-line text-left tracking-[0.012em] ${letterLanguage === "ko" ? "break-keep" : ""}`}
            style={{
              fontFamily: bodyFontFamily,
              fontSize: `${bodyFontSize}px`,
              lineHeight: bodyLineHeight,
            }}
          >
            {letterOpening ? (
              <p
                className="mb-7"
                style={{
                  color: theme.dropCapColor,
                  fontFamily: openingFontFamily,
                  fontSize: `${openingFontSize}px`,
                  lineHeight: 1.25,
                  textShadow: "0 1px 1px rgba(83,55,24,0.12)",
                }}
              >
                {letterOpening}
              </p>
            ) : null}
            <p>{paragraphs}</p>
          </div>

          {(signatureDate || signatureName) ? (
            <div className="mt-8 shrink-0 self-end text-right" style={{ color: theme.endingColor }}>
              {signatureDate ? (
                <p className={`text-[21px] tracking-[0.04em] opacity-75 ${letterLanguage === "ko" ? "font-ko" : "font-display-en"}`}>
                  {signatureDate}
                </p>
              ) : null}
              {signatureName ? (
                <p className="mt-3 text-[44px] leading-tight" style={{ fontFamily: openingFontFamily }}>
                  {signatureName}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-10 pb-16 pt-8">
          <span className="rounded-full border border-white/18 bg-black/55 px-10 py-3.5 text-center text-[24px] font-semibold tracking-[0.18em] text-white/70 shadow-[0_2px_24px_rgba(0,0,0,0.65)]">
            {siteLine}
          </span>
        </div>
      </div>
    );
  },
);
