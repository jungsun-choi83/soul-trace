"use client";
import { useLocale } from "@/components/locale-provider";
import { HeartIcon, InfinityIcon, MailIcon, PenIcon, RadioIcon, SparklesIcon } from "./icons";
import { Reveal } from "./reveal";

export function ConnectionJourney() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const steps = [[HeartIcon, "pet", false], [SparklesIcon, "memories", false], [PenIcon, "soulTrace", true], [MailIcon, "letter", false], [RadioIcon, "eternalBeam", true], [InfinityIcon, "continues", false]] as const;
  return <section id="about" className="scroll-mt-20 bg-[#0b0a09] pb-14 pt-8 text-[#f8f2e7] md:pb-20 md:pt-10"><div className="mx-auto max-w-6xl px-5 sm:px-8"><div className="mx-auto max-w-2xl text-center"><Reveal><p className="mb-4 text-xs uppercase tracking-[0.28em] text-[#c8a24a]">{t("homepage.journey.label")}</p></Reveal><Reveal delay={80}><h2 className={`${display} text-3xl font-light sm:text-5xl`}>{t("homepage.journey.title")}</h2></Reveal></div><div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">{steps.map(([Icon, key, highlight], i) => <Reveal key={key} delay={i * 30} className="relative flex min-w-0 flex-col items-center text-center">{i < steps.length - 1 && <span className="absolute left-[calc(50%+2rem)] top-7 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-[#c8a24a]/40 to-transparent lg:block" />}<div className={`grid size-14 place-items-center rounded-full border ${highlight ? "border-[#c8a24a] bg-[#c8a24a]/15 text-[#c8a24a] shadow-[0_0_24px_rgba(200,162,74,0.25)]" : "border-white/20 bg-black/20 text-white/70"}`}><Icon className="size-5" /></div><span className={`${display} mt-4 text-sm text-white/80`}>{t(`homepage.journey.${key}`)}</span></Reveal>)}</div></div></section>;
}
