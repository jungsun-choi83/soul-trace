"use client";

import { useLocale } from "@/components/locale-provider";
import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";

export function FinalCta({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";

  return (
    <section
      id="create"
      className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] pb-8 pt-10 text-[#f8f2e7] md:pb-14 md:pt-16"
    >
      <div
        className={`pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] max-w-[130%] -translate-x-1/2 rounded-full bg-[#c8a24a]/15 blur-[150px] ${styles.glow}`}
      />
      <div className="relative mx-auto max-w-3xl px-3 text-center sm:px-8">
        <Reveal>
          <p className="mb-4 text-[0.65rem] uppercase tracking-[0.24em] text-[#c8a24a] sm:mb-6 sm:text-xs sm:tracking-[0.32em]">
            Soul Trace × Eternal Beam
          </p>
        </Reveal>
        <Reveal delay={100}>
          <h2
            className={`${display} text-[clamp(1.8rem,9vw,2.25rem)] font-light leading-[1.08] sm:text-6xl lg:text-7xl`}
          >
            {t("homepage.finalCta.title")}
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <p
            className={`${display} mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/70 sm:mt-6 sm:text-lg`}
          >
            {t("homepage.finalCta.body")}
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:mt-8 sm:flex-row sm:gap-3">
            <Link
              href={choiceHref}
              className={`${display} group inline-flex min-h-11 w-auto max-w-full items-center justify-center gap-2 rounded-full bg-[#c8a24a] px-5 py-3 text-xs font-medium text-[#0b0a09] transition hover:bg-[#d8b463] sm:min-h-12 sm:px-8 sm:py-4 sm:text-sm`}
            >
              {t("homepage.finalCta.primary")}
              <ArrowRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href={getEternalBeamMainUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={`${display} inline-flex min-h-11 w-auto max-w-full items-center justify-center rounded-full border border-white/25 px-5 py-3 text-xs text-white/90 hover:border-white/60 sm:min-h-12 sm:px-8 sm:py-4 sm:text-sm`}
            >
              {t("homepage.finalCta.secondary")}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
