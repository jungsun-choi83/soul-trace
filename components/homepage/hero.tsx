"use client";

import { useLocale } from "@/components/locale-provider";
import { koreanLetterFont } from "@/components/generated-letter-fonts";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function Hero({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const body = lang === "ko" ? "font-ko break-keep" : "font-inter";
  return (
    <section id="top" className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] text-[#f8f2e7]">
      <div className={`pointer-events-none absolute -right-32 top-0 size-[600px] rounded-full bg-[#c8a24a]/15 blur-[140px] ${styles.glow}`} aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 bottom-0 size-[400px] rounded-full bg-[#ecd7a6]/10 blur-[120px]" aria-hidden="true" />
      <div className="pointer-events-none absolute left-[-8%] top-24 h-[52vw] w-[52vw] rounded-full bg-[#dba653]/12 blur-[90px] lg:left-[28%] lg:top-[10%] lg:h-[70%] lg:w-[34%] lg:bg-[#dba653]/15 lg:blur-[120px]" aria-hidden="true" />
      <div className={styles.heroScene} aria-hidden="true">
        <Image src="/images/blended page.png" alt="" fill priority sizes="100vw" className="pointer-events-none select-none object-cover object-center" />
        {lang === "ko" && (
          <svg className="pointer-events-none absolute inset-0 size-full select-none" viewBox="0 0 1774 887" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <linearGradient id="hero-letter-paper" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f7e7ca" />
                <stop offset="1" stopColor="#e8caa1" />
              </linearGradient>
            </defs>
            <polygon points="914,558 1198,522 1257,710 1004,748" fill="url(#hero-letter-paper)" />
            <g transform="rotate(-7 1085 635)" fill="#573923" className={koreanLetterFont.className}>
              <text x="942" y="580" fontSize="21">우리 사람에게,</text>
              <text x="942" y="610" fontSize="19">언제나 우리 곁에 있어줘서</text>
              <text x="942" y="638" fontSize="19">고마워요. 당신은 우리의</text>
              <text x="942" y="666" fontSize="19">평범한 하루를 특별하게</text>
              <text x="942" y="694" fontSize="19">만들어줘요.</text>
              <text x="1058" y="724" fontSize="18">사랑을 담아, 털복숭이 친구들이</text>
            </g>
          </svg>
        )}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[28%] bg-gradient-to-r from-[#0b0a09] via-[#1b1208]/45 to-transparent lg:w-[58%]" aria-hidden="true" />
      </div>
      <div className={styles.heroTopWave} aria-hidden="true" />
      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-20 pt-28 sm:px-8 md:pb-24 md:pt-36 lg:grid-cols-2 lg:gap-10 lg:pb-28 lg:pt-44">
        <div className="order-2 min-w-0 lg:order-1">
          <Reveal><p className={`mb-6 flex items-center gap-3 text-xs font-medium uppercase text-[#c8a24a] ${lang === "ko" ? "tracking-normal" : "tracking-[0.28em]"}`}><span className="h-px w-8 bg-[#c8a24a]/60" />{t("homepage.hero.label")}</p></Reveal>
          <Reveal delay={80}><h1 className={`${display} text-[2.6rem] font-light leading-[1.08] sm:text-6xl lg:text-7xl`}><span className="block whitespace-pre-line">{t("homepage.hero.title1")}</span><span className="mt-2 block text-[#ecd7a6]">{t("homepage.hero.title2")}</span></h1></Reveal>
          <Reveal delay={160}><p className={`mt-7 max-w-md text-base leading-relaxed text-[#f8f2e7]/70 sm:text-lg ${body}`}>{t("homepage.hero.body")}</p></Reveal>
          <Reveal delay={240}><div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"><Link href={choiceHref} className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#c8a24a] px-7 py-4 text-sm font-medium text-[#0b0a09] transition hover:bg-[#d8b463] ${body}`}>{t("homepage.hero.primary")}<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></Link><a href="#eternal-beam" className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[#f8f2e7]/25 px-7 py-4 text-sm text-[#f8f2e7]/90 hover:border-[#f8f2e7]/60 ${body}`}>{t("homepage.hero.secondary")}</a></div></Reveal>
        </div>
        <div className="order-1 h-[75vw] min-w-0 lg:order-2 lg:h-[34rem]" aria-hidden="true" />
      </div>
    </section>
  );
}
