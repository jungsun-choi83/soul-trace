"use client";

import { useLocale } from "@/components/locale-provider";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function EternalBeam({
  product,
  features,
}: {
  product: ReactNode;
  features: ReactNode;
}) {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";

  return (
    <section
      id="eternal-beam"
      className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] py-10 text-[#f8f2e7] md:py-14"
    >
      <Image
        src="/homepage/eternal-beam/cinematic.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0a09] via-[#0b0a09]/70 to-[#0b0a09]" />
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 size-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8a24a]/15 blur-[110px] ${styles.glow}`}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-[44%_56%] items-center gap-3 px-2 sm:px-8 md:grid-cols-[36%_38%_26%] md:gap-6 lg:gap-10">
        <div className="min-w-0">
          <Reveal>
            <p className="mb-3 bg-gradient-to-r from-[#a77d27] via-[#f2d987] to-[#a77d27] bg-clip-text font-[family-name:var(--font-cormorant)] text-sm font-medium uppercase tracking-[0.14em] text-transparent drop-shadow-[0_0_18px_rgba(200,162,74,0.24)] sm:text-2xl sm:tracking-[0.24em] lg:mb-5 lg:text-4xl lg:tracking-[0.3em]">
              ETERNAL BEAM
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2
              className={`${display} text-[clamp(1.25rem,5.8vw,2rem)] font-light leading-tight sm:text-4xl lg:text-5xl`}
            >
              {t("homepage.eternalBeam.title")}
            </h2>
          </Reveal>
          <Reveal delay={140}>
            <p
              className={`${display} mt-3 max-w-xl text-[0.68rem] leading-relaxed text-[#f8f2e7]/75 sm:mt-4 sm:text-sm lg:mt-5 lg:text-base`}
            >
              {t("homepage.eternalBeam.body")}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <a
              href={getEternalBeamMainUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={`${display} group mt-5 inline-flex min-h-8 max-w-full items-center gap-1 rounded-full border border-[#c8a24a]/40 px-3 py-2 text-[0.55rem] leading-tight text-[#c8a24a] transition hover:bg-[#c8a24a] hover:text-[#0b0a09] sm:mt-6 sm:min-h-10 sm:gap-2 sm:px-5 sm:py-3 sm:text-xs lg:mt-7 lg:min-h-11 lg:px-6 lg:py-3 lg:text-sm`}
            >
              <span>{t("homepage.eternalBeam.cta")}</span>
              <ArrowRightIcon className="size-3 shrink-0 transition-transform group-hover:translate-x-1 sm:size-4" />
            </a>
          </Reveal>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-6 md:contents">
          <div className="min-w-0">{product}</div>
          <div className="min-w-0 md:col-start-3">{features}</div>
        </div>
      </div>
    </section>
  );
}
