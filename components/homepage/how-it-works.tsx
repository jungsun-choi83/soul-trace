"use client";
import { useLocale } from "@/components/locale-provider";
import { MailIcon, PenIcon, SparklesIcon } from "./icons";
import { Reveal } from "./reveal";

export function HowItWorks() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const steps = [[PenIcon, "share"], [MailIcon, "receive"], [SparklesIcon, "discover"]] as const;
  return <section id="how-it-works" className="scroll-mt-20 bg-[#f8f2e7] py-14 text-[#1a1512] md:py-20"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><Reveal><p className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-[#c8a24a]">{t("homepage.howItWorks.label")}</p></Reveal><Reveal delay={80}><h2 className={`${display} text-[1.6875rem] font-light sm:text-5xl`}>{t("homepage.howItWorks.title")}</h2></Reveal></div><div className="relative mt-10 grid grid-cols-1 gap-8 md:grid-cols-3"><div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-[#c8a24a]/40 to-transparent md:block" />{steps.map(([Icon, key], i) => <Reveal key={key} delay={i * 70} className="relative min-w-0 text-center"><div className="relative mx-auto grid size-16 place-items-center rounded-full border border-[#c8a24a]/30 bg-[#f3ebda]"><Icon className="size-6 text-[#c8a24a]" /><span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-[#1a1512] text-xs text-[#f8f2e7]">{i + 1}</span></div><h3 className={`${display} mt-6 text-2xl`}>{t(`homepage.howItWorks.${key}Title`)}</h3><p className={`${display} mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[#1a1512]/65`}>{t(`homepage.howItWorks.${key}Body`)}</p></Reveal>)}</div></div></section>;
}
