"use client";

import { useLocale } from "@/components/locale-provider";
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
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 pb-20 pt-28 sm:px-8 md:pb-24 md:pt-36 lg:grid-cols-2 lg:gap-10 lg:pb-28 lg:pt-44">
        <div className="order-2 min-w-0 lg:order-1">
          <Reveal><p className={`mb-6 flex items-center gap-3 text-xs font-medium uppercase text-[#c8a24a] ${lang === "ko" ? "tracking-normal" : "tracking-[0.28em]"}`}><span className="h-px w-8 bg-[#c8a24a]/60" />{t("homepage.hero.label")}</p></Reveal>
          <Reveal delay={80}><h1 className={`${display} text-[2.6rem] font-light leading-[1.08] sm:text-6xl lg:text-7xl`}><span className="block">{t("homepage.hero.title1")}</span><span className="mt-2 block text-[#ecd7a6]">{t("homepage.hero.title2")}</span></h1></Reveal>
          <Reveal delay={160}><p className={`mt-7 max-w-md text-base leading-relaxed text-[#f8f2e7]/70 sm:text-lg ${body}`}>{t("homepage.hero.body")}</p></Reveal>
          <Reveal delay={240}><div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"><Link href={choiceHref} className={`group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#c8a24a] px-7 py-4 text-sm font-medium text-[#0b0a09] transition hover:bg-[#d8b463] ${body}`}>{t("homepage.hero.primary")}<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></Link><a href="#eternal-beam" className={`inline-flex min-h-12 items-center justify-center rounded-full border border-[#f8f2e7]/25 px-7 py-4 text-sm text-[#f8f2e7]/90 hover:border-[#f8f2e7]/60 ${body}`}>{t("homepage.hero.secondary")}</a></div></Reveal>
        </div>
        <div className="relative order-1 min-w-0 pb-5 lg:order-2 lg:pb-0">
          <Reveal delay={120}><div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl"><Image src="/homepage/pets/hero-dog.png" alt={t("homepage.accessibility.heroDogAlt")} fill priority sizes="(max-width: 1024px) calc(100vw - 40px), 40vw" className="object-cover object-[50%_42%]" /><div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09]/70 via-transparent to-transparent" /></div></Reveal>
          <div className={`absolute -bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-[300px] -translate-x-1/2 sm:left-4 sm:translate-x-0 lg:-left-6 ${styles.float}`}><div className="rounded-2xl border border-[#c8a24a]/25 bg-[#f3ebda]/95 p-5 text-[#1a1512] shadow-2xl backdrop-blur"><p className="font-display-en text-xs uppercase !tracking-[0.25em] text-[#c8a24a]">Soul Trace</p><p className={`mt-2 text-lg ${display}`}>{t("homepage.hero.cardName")}</p><p className={`mt-1 text-sm leading-relaxed text-[#1a1512]/70 ${body}`}>{t("homepage.hero.cardLine")}</p></div></div>
        </div>
      </div>
    </section>
  );
}
