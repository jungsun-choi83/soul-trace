"use client";
import { useLocale } from "@/components/locale-provider";
import { StarIcon, SunIcon } from "./icons";
import { Reveal } from "./reveal";

export function LivingMemorial() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const cards = [[SunIcon, "living", false], [StarIcon, "memorial", true]] as const;
  return <section className="bg-[#f8f2e7] pb-10 pt-14 text-[#1a1512] md:pb-14 md:pt-20"><div className="mx-auto max-w-6xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><Reveal><p className="mb-4 text-xs uppercase tracking-[0.28em] text-[#c8a24a]">{t("homepage.livingMemorial.label")}</p></Reveal><Reveal delay={80}><h2 className={`${display} text-3xl font-light leading-tight sm:text-4xl`}>{t("homepage.livingMemorial.title")}</h2></Reveal></div><div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">{cards.map(([Icon, key, dark], i) => <Reveal key={key} delay={i * 80} className={`min-w-0 overflow-hidden rounded-3xl p-8 sm:p-10 ${dark ? "bg-[#1a1512] text-[#f8f2e7]" : "border border-[#1a1512]/10 bg-[#f3ebda]"}`}><div className="grid size-12 place-items-center rounded-full bg-[#c8a24a]/10 text-[#c8a24a]"><Icon className="size-5" /></div><h3 className={`${display} mt-6 text-2xl`}>{t(`homepage.livingMemorial.${key}Title`)}</h3><p className={`${display} mt-3 leading-relaxed ${dark ? "text-white/70" : "text-[#1a1512]/65"}`}>{t(`homepage.livingMemorial.${key}Body`)}</p></Reveal>)}</div></div></section>;
}
