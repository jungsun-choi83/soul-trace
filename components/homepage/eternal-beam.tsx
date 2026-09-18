"use client";
import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function EternalBeam() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  return <section id="eternal-beam" className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] py-24 text-[#f8f2e7] md:py-36"><Image src="/homepage/eternal-beam/cinematic.png" alt="" fill sizes="100vw" className="object-cover opacity-40" /><div className="absolute inset-0 bg-gradient-to-b from-[#0b0a09] via-[#0b0a09]/70 to-[#0b0a09]" /><div className={`pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8a24a]/15 blur-[120px] ${styles.glow}`} /><div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8"><Reveal><div className="mb-8 flex w-full items-center justify-center overflow-visible" aria-label="Eternal Beam"><Image src="/images/homepage/eternal-beam-logo.png" alt="Eternal Beam" width={180} height={180} sizes="(max-width: 639px) 150px, 180px" className="block h-auto w-[min(100%,150px)] object-contain sm:w-[180px]" priority /></div></Reveal><Reveal delay={100}><h2 className={`${display} text-4xl font-light leading-tight sm:text-6xl`}>{t("homepage.eternalBeam.title")}</h2></Reveal><Reveal delay={200}><p className={`${display} mx-auto mt-7 max-w-xl text-base leading-relaxed text-[#f8f2e7]/75 sm:text-lg`}>{t("homepage.eternalBeam.body")}</p></Reveal></div></section>;
}
