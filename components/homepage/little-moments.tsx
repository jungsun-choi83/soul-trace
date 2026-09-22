"use client";
import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { Reveal } from "./reveal";

export function LittleMoments() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const cards = [
    ["sleep", "/homepage/moments/moment-sleep.png", ""],
    ["wait", "/homepage/moments/moment-wait.png", ""],
    ["bond", "/homepage/moments/moment-bond.png", ""],
  ];
  return <section className="bg-[#f3ebda] py-20 text-[#1a1512] md:py-28"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><Reveal><p className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-[#c8a24a]">{t("homepage.moments.label")}</p></Reveal><Reveal delay={80}><h2 className={`${display} text-3xl font-light leading-tight sm:text-5xl`}>{t("homepage.moments.title")}</h2></Reveal><Reveal delay={160}><p className={`mx-auto mt-5 max-w-lg text-base leading-relaxed text-[#1a1512]/65 ${display}`}>{t("homepage.moments.body")}</p></Reveal></div><div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([key, src, span], i) => <Reveal key={key} delay={i * 120} className={`group relative min-w-0 overflow-hidden rounded-2xl ${span}`}><div className="relative h-64 w-full sm:h-full sm:min-h-64"><Image src={src} alt={t(`homepage.accessibility.moment${key[0].toUpperCase()}${key.slice(1)}Alt`)} fill sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-[#0b0a09]/75 via-[#0b0a09]/10 to-transparent" /><p className={`${display} absolute inset-x-0 bottom-0 p-6 text-xl text-[#f8f2e7] md:text-2xl`}>{t(`homepage.moments.${key}`)}</p></div></Reveal>)}</div><div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">{["toy", "sound", "quiet"].map((key, i) => <Reveal key={key} delay={i * 100} className="rounded-2xl border border-[#1a1512]/10 bg-[#f8f2e7]/60 p-6"><span className="font-display-en text-3xl text-[#c8a24a]">“</span><p className={`${display} -mt-3 text-lg italic text-[#1a1512]/80`}>{t(`homepage.moments.${key}`)}</p></Reveal>)}</div></div></section>;
}
