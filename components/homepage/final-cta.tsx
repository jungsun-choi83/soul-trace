"use client";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function FinalCta({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  return <section id="create" className="relative scroll-mt-20 overflow-hidden bg-[#0b0a09] py-24 text-[#f8f2e7] md:py-36"><div className={`pointer-events-none absolute left-1/2 top-0 h-[500px] w-[700px] max-w-[130%] -translate-x-1/2 rounded-full bg-[#c8a24a]/15 blur-[150px] ${styles.glow}`} /><div className="relative mx-auto max-w-3xl px-5 text-center sm:px-8"><Reveal><p className="mb-6 text-xs uppercase tracking-[0.32em] text-[#c8a24a]">Soul Trace × Eternal Beam</p></Reveal><Reveal delay={100}><h2 className={`${display} text-4xl font-light leading-[1.08] sm:text-6xl lg:text-7xl`}>{t("homepage.finalCta.title")}</h2></Reveal><Reveal delay={200}><p className={`${display} mx-auto mt-7 max-w-xl leading-relaxed text-white/70 sm:text-lg`}>{t("homepage.finalCta.body")}</p></Reveal><Reveal delay={280}><div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"><Link href={choiceHref} className={`${display} group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c8a24a] px-8 py-4 text-sm font-medium text-[#0b0a09] transition hover:bg-[#d8b463] sm:w-auto`}>{t("homepage.finalCta.primary")}<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></Link><a href="#eternal-beam" className={`${display} inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/25 px-8 py-4 text-sm text-white/90 hover:border-white/60 sm:w-auto`}>{t("homepage.finalCta.secondary")}</a></div></Reveal></div></section>;
}
