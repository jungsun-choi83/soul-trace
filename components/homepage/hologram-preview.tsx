"use client";
import { useLocale } from "@/components/locale-provider";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

function ProjectedPet() {
  const { t } = useLocale();
  return <div className="relative mx-auto aspect-video lg:aspect-[3/4] w-full overflow-hidden rounded-t-3xl"><div className="absolute inset-0 bg-gradient-to-b from-[#c8a24a]/10 via-transparent to-[#c8a24a]/5" /><video src="/videos/unsounded-play.mp4" poster="/homepage/eternal-beam/hologram-pet.png" aria-label={t("homepage.accessibility.hologramPetAlt")} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-contain" /><div className={`${styles.scanLines} pointer-events-none absolute inset-0 opacity-30`} /></div>;
}

export function HologramPreview() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  return <section className="relative overflow-hidden bg-[#0b0a09] pb-10 pt-0 text-[#f8f2e7] md:pb-14"><div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:gap-12"><Reveal className="order-1 flex justify-center"><div className="relative w-full max-w-sm"><div className={`absolute bottom-8 left-1/2 h-24 w-64 max-w-[75%] -translate-x-1/2 rounded-full bg-[#c8a24a]/25 blur-3xl ${styles.glow}`} /><ProjectedPet /><div className="relative mx-auto -mt-2 h-6 w-3/4 rounded-full bg-gradient-to-b from-[#241d18] to-[#0b0a09] shadow-[0_0_40px_rgba(200,162,74,0.2)]" /><div className="mx-auto mt-2 flex items-center justify-center gap-2"><span className={`size-1.5 rounded-full bg-[#c8a24a] ${styles.glow}`} /><span className="text-[0.65rem] uppercase tracking-[0.25em] text-[#c8a24a]/80">{t("homepage.hologram.live")}</span></div></div></Reveal><div className="order-2 min-w-0"><Reveal><p className={`${display} mb-4 text-xs uppercase text-[#c8a24a] ${lang === "ko" ? "tracking-normal" : "tracking-[0.28em]"}`}>{t("homepage.hologram.caption")}</p></Reveal><Reveal delay={100}><h2 className={`${display} text-3xl font-light leading-tight sm:text-5xl`}>{t("homepage.hologram.title")}</h2></Reveal><Reveal delay={120}><p className={`${display} mt-5 max-w-md leading-relaxed text-[#f8f2e7]/70`}>{t("homepage.hologram.body")}</p></Reveal><Reveal delay={160}><a href={getEternalBeamMainUrl()} target="_blank" rel="noopener noreferrer" className={`${display} group mt-8 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#c8a24a]/40 px-7 py-4 text-sm text-[#c8a24a] transition hover:bg-[#c8a24a] hover:text-[#0b0a09]`}>{t("homepage.hologram.cta")}<ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" /></a></Reveal></div></div></section>;
}
