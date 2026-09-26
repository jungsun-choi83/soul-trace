"use client";

import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function Hero({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const body = lang === "ko" ? "font-ko break-keep" : "font-inter";

  return (
    <section
      id="top"
      className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] text-[#f8f2e7]"
    >
      <div
        className={`pointer-events-none absolute -right-32 top-0 size-[600px] rounded-full bg-[#c8a24a]/15 blur-[140px] ${styles.glow}`}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-40 bottom-0 size-[400px] rounded-full bg-[#ecd7a6]/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-[-8%] top-24 h-[52vw] w-[52vw] rounded-full bg-[#dba653]/12 blur-[90px] lg:left-[28%] lg:top-[10%] lg:h-[70%] lg:w-[34%] lg:bg-[#dba653]/15 lg:blur-[120px]"
        aria-hidden="true"
      />
      <div className={styles.heroScene} aria-hidden="true">
        <Image
          src="/images/homepage.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className={`pointer-events-none select-none ${styles.heroImage}`}
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[72%] bg-gradient-to-r from-[#0b0a09] via-[#1b1208]/70 to-transparent lg:w-[58%] lg:via-[#1b1208]/45"
          aria-hidden="true"
        />
      </div>
      <div className={styles.heroTopWave} aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-[clamp(34rem,140vw,40rem)] max-w-7xl items-center px-[clamp(1.25rem,5vw,2rem)] pb-[clamp(2.5rem,8vw,5rem)] pt-[clamp(6rem,22vw,8rem)] lg:grid lg:min-h-[52rem] lg:grid-cols-2 lg:gap-10 lg:px-8 lg:pb-28 lg:pt-44">
        <div className="min-w-0 max-w-[68%] sm:max-w-[55%] lg:max-w-none">
          <Reveal>
            <p
              className={`mb-[clamp(0.875rem,3vw,1.5rem)] flex min-w-0 items-center gap-[clamp(0.5rem,2vw,0.75rem)] text-xs font-medium uppercase text-[#c8a24a] ${lang === "ko" ? "tracking-normal" : "tracking-[0.12em] lg:tracking-[0.28em]"}`}
            >
              <span className="h-px w-[clamp(1.25rem,5vw,2rem)] shrink-0 bg-[#c8a24a]/60" />
              {t("homepage.hero.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1
              className={`${display} text-[clamp(2rem,9vw,2.6rem)] font-light leading-[1.08] sm:text-5xl lg:text-7xl`}
            >
              <span className="block whitespace-pre-line">
                {t("homepage.hero.title1")}
              </span>
              <span className="mt-[clamp(0.375rem,1.5vw,0.5rem)] block text-[#ecd7a6]">
                {t("homepage.hero.title2")}
              </span>
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p
              className={`mt-[clamp(1rem,4vw,1.75rem)] max-w-md text-sm leading-relaxed text-[#f8f2e7]/75 sm:text-base lg:text-lg ${body}`}
            >
              {t("homepage.hero.body")}
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-[clamp(1.25rem,5vw,2.25rem)] flex flex-col items-start gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap lg:gap-3">
              <Link
                href={choiceHref}
                className={`group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#c8a24a] px-4 py-3 text-center text-xs font-medium leading-tight text-[#0b0a09] transition hover:bg-[#d8b463] sm:px-5 sm:text-sm lg:min-h-12 lg:px-7 lg:py-4 ${body}`}
              >
                {t("homepage.hero.primary")}
                <ArrowRightIcon className="size-3.5 shrink-0 transition-transform group-hover:translate-x-1 lg:size-4" />
              </Link>
              <a
                href="#eternal-beam"
                className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#f8f2e7]/25 px-4 py-3 text-center text-xs leading-tight text-[#f8f2e7]/90 hover:border-[#f8f2e7]/60 sm:px-5 sm:text-sm lg:min-h-12 lg:px-7 lg:py-4 ${body}`}
              >
                {t("homepage.hero.secondary")}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
