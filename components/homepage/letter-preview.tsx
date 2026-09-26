"use client";

import { useLocale } from "@/components/locale-provider";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";

export function LetterPreview() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";

  return (
    <section className="relative overflow-hidden bg-[#1a1512] py-14 text-[#f8f2e7] md:py-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8a24a]/10 blur-[130px]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[56%_44%] items-center gap-2 px-2 sm:grid-cols-[54%_46%] sm:gap-6 sm:px-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <Reveal>
            <p className="mb-2 text-[0.55rem] uppercase tracking-[0.16em] text-[#c8a24a] sm:mb-3 sm:text-[0.625rem] sm:tracking-[0.22em] lg:mb-4 lg:text-xs lg:tracking-[0.28em]">
              {t("homepage.letter.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className={`${display} text-[clamp(1.2rem,5.8vw,1.75rem)] font-light leading-tight sm:text-4xl lg:text-5xl`}
            >
              {t("homepage.letter.title")}
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p
              className={`${display} mt-3 max-w-md text-[0.68rem] leading-relaxed text-[#f8f2e7]/70 sm:mt-4 sm:text-sm lg:mt-5 lg:text-base`}
            >
              {t("homepage.letter.body")}
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-4 space-y-2 sm:mt-6 sm:space-y-3 lg:mt-9 lg:space-y-4">
              <div className="rounded-lg border border-white/10 bg-black/25 p-2 sm:rounded-xl sm:p-3 lg:p-4">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-white/40 sm:text-[0.6rem] sm:tracking-[0.18em] lg:text-[0.7rem] lg:tracking-[0.22em]">
                  {t("homepage.letter.memoryLabel")}
                </p>
                <p
                  className={`${display} mt-1 text-[0.65rem] leading-snug text-white/80 sm:mt-1.5 sm:text-xs lg:text-sm`}
                >
                  {t("homepage.letter.memoryText")}
                </p>
              </div>
              <div className="flex justify-center">
                <ArrowRightIcon className="size-3 rotate-90 text-[#c8a24a] sm:size-4 lg:size-5" />
              </div>
              <div className="rounded-lg border border-[#c8a24a]/25 bg-[#c8a24a]/5 p-2 sm:rounded-xl sm:p-3 lg:p-4">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-[#c8a24a] sm:text-[0.6rem] sm:tracking-[0.18em] lg:text-[0.7rem] lg:tracking-[0.22em]">
                  {t("homepage.letter.letterLabel")}
                </p>
                <p
                  className={`${display} mt-1 text-[0.68rem] italic leading-snug text-white/90 sm:mt-1.5 sm:text-sm lg:text-base`}
                >
                  {t("homepage.letter.letterText")}
                </p>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120} className="flex min-w-0 justify-center">
          <div className="relative w-full max-w-sm rotate-1 rounded-sm bg-[#f3ebda] p-2 text-[#1a1512] shadow-2xl transition-transform duration-500 hover:rotate-0 sm:p-5 lg:p-10">
            <div className="absolute right-1 top-1 h-8 w-6 rounded-sm border border-[#c8a24a]/40 bg-[#c8a24a]/10 text-center sm:right-3 sm:top-3 sm:h-11 sm:w-8 lg:right-6 lg:top-6 lg:h-14 lg:w-11">
              <span className="mt-1.5 block text-[0.38rem] uppercase leading-tight tracking-[0.08em] text-[#c8a24a] sm:mt-2 sm:text-[0.5rem] sm:tracking-[0.12em] lg:mt-3 lg:text-[0.6rem] lg:tracking-[0.15em]">
                Soul
                <br />
                Trace
              </span>
            </div>
            <p
              className={`${display} pr-7 text-sm sm:pr-10 sm:text-xl lg:pr-14 lg:text-2xl`}
            >
              {t("homepage.letter.paperName")}
            </p>
            <div
              className={`${display} mt-2 space-y-1 text-[0.65rem] leading-relaxed text-[#1a1512]/85 sm:mt-4 sm:space-y-2 sm:text-sm lg:mt-5 lg:space-y-3 lg:text-lg`}
            >
              <p>{t("homepage.letter.letterText")}</p>
            </div>
            <p
              className={`${display} mt-3 text-[0.6rem] italic text-[#1a1512]/70 sm:mt-5 sm:text-xs lg:mt-8 lg:text-base`}
            >
              {t("homepage.letter.paperFrom")}
            </p>
            <div className="mt-3 h-px bg-black/10 sm:mt-4 lg:mt-6" />
            <p className="font-display-en mt-2 text-[0.45rem] uppercase !tracking-[0.14em] text-[#c8a24a] sm:mt-3 sm:text-[0.55rem] sm:!tracking-[0.2em] lg:mt-4 lg:text-[0.65rem] lg:!tracking-[0.25em]">
              Soul Trace
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
