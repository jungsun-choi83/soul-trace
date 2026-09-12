"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";
import type { ReactNode } from "react";

const STEP_KEYS = ["pet", "questions", "letter"] as const;

function PawIcon({ className = "" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.1 10.2c1.25-.28 1.65-2.08.88-3.55-.78-1.48-2.44-2.08-3.7-1.33-1.26.74-1.64 2.55-.86 4.02.78 1.48 2.42 1.14 3.68.85Zm7.8 0c-1.25-.28-1.65-2.08-.88-3.55.78-1.48 2.44-2.08 3.7-1.33 1.26.74 1.64 2.55.86 4.02-.78 1.48-2.42 1.14-3.68.85ZM12 9.1c1.42 0 2.58-1.6 2.58-3.58S13.42 2 12 2 9.42 3.56 9.42 5.52 10.58 9.1 12 9.1Zm0 2.25c-3.08 0-6.4 3.36-6.4 6.16 0 2.32 1.84 4.14 4.22 3.16.83-.34 1.4-.72 2.18-.72s1.35.38 2.18.72c2.38.98 4.22-.84 4.22-3.16 0-2.8-3.32-6.16-6.4-6.16Z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function NoteIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 3.75h7l3 3v13.5h-11a2 2 0 0 1-2-2V6.75a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round"/><path d="M14.5 3.75v3h3M8.25 11h5.5M8.25 14.5h7.5" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round"/></svg>;
}

function HeartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.4 5.8a5.05 5.05 0 0 0-7.15 0L12 7.05 10.75 5.8a5.06 5.06 0 0 0-7.15 7.16L12 21l8.4-8.04a5.05 5.05 0 0 0 0-7.16Z" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function EnvelopeIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.35"/><path d="m4.25 7 7.1 5.5a1.05 1.05 0 0 0 1.3 0L19.75 7" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function SprigIcon() {
  return <svg viewBox="0 0 58 48" fill="none" aria-hidden="true"><path d="M7 43C20 34 30 25 44 7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/><path d="M20 33c-6 1-9-1-11-5 6-1 9 1 11 5Zm9-9c-1-6 1-9 5-12 1 6-1 9-5 12Zm7-8c-1-5 1-8 5-10 1 5-1 8-5 10Zm-9 10c5-1 8 1 10 4-5 1-8-1-10-4Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/></svg>;
}

function BlossomIcon() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M24 25c-9-1-12-7-9-12 4-5 9-1 9 4 0-6 5-9 9-5 4 4 0 10-6 12 6-1 10 4 7 9-3 5-9 3-11-3-1 6-8 8-11 3-3-5 3-9 12-8Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/><circle cx="24" cy="24" r="2.2" stroke="currentColor" strokeWidth="1"/><path d="M22 31c-2 6-5 10-10 14M17 39c-4 0-6-2-7-5 4 0 6 2 7 5Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

const STEP_ICONS: Record<(typeof STEP_KEYS)[number], ReactNode> = { pet: <NoteIcon />, questions: <HeartIcon />, letter: <EnvelopeIcon /> };

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const headingFont = lang === "ko" ? "font-ko break-keep !tracking-normal" : "font-display-en !tracking-normal";
  const bodyFont = lang === "ko" ? "font-ko break-keep !tracking-normal" : "font-display-en !tracking-normal";
  const [previewGreeting = "", previewBody = "", previewClosing = ""] = t("welcome.letterPreview").split("\n\n");

  return (
    <main className="min-h-[100svh] scroll-smooth overflow-x-hidden bg-[#0D0A07] text-[#F3EAD8]">
      <section className="relative isolate min-h-[100svh] overflow-hidden bg-black bg-cover bg-[61%_center] sm:bg-[58%_center] lg:min-h-[44rem] lg:h-[84svh] lg:bg-[55%_center] xl:bg-center" style={{ backgroundImage: "url('/images/soul-trace-hero-poster.jpg')" }}>
        <video className="absolute inset-0 -z-30 h-full w-full object-cover object-[61%_center] motion-reduce:hidden sm:object-[58%_center] lg:object-[55%_center] xl:object-center" autoPlay muted loop playsInline preload="metadata" poster="/images/soul-trace-hero-poster.jpg" aria-hidden="true">
          <source src="/videos/soul-trace-hero-smooth.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(5,4,3,0.91)_0%,rgba(5,4,3,0.72)_34%,rgba(5,4,3,0.22)_58%,rgba(5,4,3,0.06)_76%,rgba(5,4,3,0.3)_100%)] sm:bg-[linear-gradient(90deg,rgba(5,4,3,0.9)_0%,rgba(5,4,3,0.65)_36%,rgba(5,4,3,0.1)_68%,rgba(5,4,3,0.28)_100%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_62%_38%,transparent_24%,rgba(3,2,2,0.07)_58%,rgba(3,2,2,0.55)_100%)] sm:bg-[radial-gradient(ellipse_at_58%_38%,transparent_25%,rgba(3,2,2,0.08)_56%,rgba(3,2,2,0.52)_100%)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-[5] h-[48%] bg-[linear-gradient(180deg,rgba(13,10,7,0)_0%,rgba(13,10,7,0.18)_26%,rgba(13,10,7,0.56)_64%,rgba(13,10,7,0.88)_86%,#0D0A07_100%)]" aria-hidden="true" />

        <header className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-2 px-4 pb-4 pt-5 min-[375px]:px-5 min-[375px]:pt-6 sm:px-7 sm:pb-5 sm:pt-7 md:px-10 lg:px-12 lg:pt-8">
          <p className="font-display-en shrink-0 text-[11px] uppercase !tracking-[0.14em] text-[#F3EAD8] min-[375px]:text-xs sm:text-base">Soul Trace</p>
          <div className="flex min-w-0 items-center justify-end gap-1 min-[375px]:gap-2 sm:gap-5">
            <a href="#how-it-works" className={`whitespace-nowrap rounded-sm text-[10px] text-[#F3EAD8]/78 transition hover:text-[#F3EAD8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] min-[375px]:text-[11px] sm:text-sm ${bodyFont}`}>{t("welcome.navHowItWorks")}</a>
            <LanguageToggle />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[90rem] px-4 pt-9 min-[375px]:px-5 sm:px-7 sm:pt-11 md:px-10 lg:px-12 lg:pt-[clamp(3rem,6vh,5rem)]">
          <div className="w-[82%] max-w-[39rem] sm:w-[68%] lg:w-[47%]">
            <p className={`mb-3 text-[9px] uppercase !tracking-[0.07em] text-[#DCBB65] min-[375px]:text-[10px] sm:mb-4 sm:text-xs lg:text-sm ${bodyFont}`}>{t("welcome.eyebrow")}</p>
            <h1 className={`whitespace-pre-line text-[1.9rem] font-light leading-[1.14] text-[#FFF9EC] drop-shadow-[0_3px_24px_rgba(0,0,0,0.78)] min-[375px]:text-[2.15rem] min-[430px]:text-[2.35rem] sm:text-[2.85rem] lg:text-[3.45rem] xl:text-[3.85rem] ${headingFont}`}>{t("welcome.title")}</h1>
            <p className={`mt-4 max-w-[35rem] text-[11px] font-light leading-[1.75] text-[#F3EAD8]/90 min-[375px]:text-xs sm:mt-5 sm:text-base sm:leading-7 lg:text-lg lg:leading-8 ${bodyFont}`}>{t("welcome.description")}</p>
            <Link href={choiceHref} className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-[#F3EAD8] px-4 py-3 text-center text-[11px] font-medium text-[#17130E] shadow-[0_12px_36px_rgba(0,0,0,0.34)] transition hover:-translate-y-0.5 hover:bg-[#FFF9EC] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3EAD8] motion-reduce:transform-none min-[375px]:px-5 min-[375px]:text-xs sm:mt-7 sm:min-h-14 sm:px-8 sm:text-base ${bodyFont}`}>{t("welcome.cta")}</Link>
          </div>

          <article data-translucent-letter-preview className="absolute bottom-[8%] right-[5%] h-[12.5rem] w-[50%] max-w-[12rem] overflow-hidden rounded-[0.35rem_0.9rem_0.9rem_0.4rem] border border-[#F6E6C4]/24 border-l-[#D8B978]/32 bg-[#F4E6CC]/48 px-3.5 py-3.5 text-[#35291F] shadow-[4px_9px_26px_rgba(10,7,4,0.09),inset_3px_0_8px_rgba(91,58,26,0.08),inset_-1px_0_0_rgba(255,250,235,0.28)] backdrop-blur-[14px] backdrop-saturate-[1.12] min-[430px]:right-[6%] min-[430px]:w-[48%] min-[430px]:max-w-[13rem] sm:h-[14rem] sm:w-[38%] sm:max-w-[15rem] sm:px-5 sm:py-4.5 lg:bottom-[7vh] lg:right-[4.5vw] lg:h-[14.5rem] lg:w-[31%] lg:max-w-[30rem] lg:rotate-[1.75deg] lg:px-5 lg:py-5 motion-reduce:rotate-0">
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(92deg,rgba(132,91,43,0.08)_0%,rgba(255,252,241,0.13)_9%,rgba(255,248,228,0.025)_54%,rgba(255,252,241,0.12)_100%)]" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(rgba(111,80,40,0.28)_0.4px,transparent_0.6px)] [background-size:4px_4px]" aria-hidden="true" />
            <span className="pointer-events-none absolute inset-y-0 left-[7px] w-px bg-gradient-to-b from-transparent via-[#8A6737]/18 to-transparent sm:left-[10px]" aria-hidden="true" />
            <span className="pointer-events-none absolute -left-3 -top-2 w-14 rotate-[-16deg] text-[#8A6030]/48 sm:w-16" aria-hidden="true"><BlossomIcon /></span>
            <span className="pointer-events-none absolute -right-3 top-[42%] w-12 rotate-[18deg] text-[#8A6030]/40 sm:w-14" aria-hidden="true"><BlossomIcon /></span>
            <span className="pointer-events-none absolute right-[18%] top-[32%] w-7 rotate-[14deg] text-[#76552E]/22 sm:w-9" aria-hidden="true"><PawIcon /></span>
            <span className="pointer-events-none absolute bottom-[18%] left-[12%] w-6 rotate-[-18deg] text-[#76552E]/22 sm:w-8" aria-hidden="true"><PawIcon /></span>
            <div className="relative">
              <div className="flex items-center gap-1.5 border-b border-[#8A6737]/20 pb-1.5 text-[#68471F] sm:pb-2"><PawIcon className="size-3.5 sm:size-4" /><span className="font-display-en text-[9px] font-medium uppercase !tracking-[0.1em] drop-shadow-[0_1px_0_rgba(255,249,232,0.65)] sm:text-xs">Soul Trace</span></div>
              <div className="mt-2.5 text-[9px] leading-[1.65] tracking-normal min-[375px]:text-[9.5px] sm:mt-3 sm:text-[13px] sm:leading-5 lg:text-sm lg:leading-[1.7]" style={{ fontFamily: '"Segoe Print", "Bradley Hand", "Apple Chancery", "Nanum Pen Script", cursive' }}>
                <p>{previewGreeting}</p><p className="mt-2 whitespace-pre-line sm:mt-3">{previewBody}</p><div className="mt-2 flex items-center gap-1.5 text-[#76552E] sm:mt-3"><p>{previewClosing}</p><span className="inline-block size-3 text-[#914E35]/90 sm:size-4"><HeartIcon /></span></div>
              </div>
            </div>
            <span className="pointer-events-none absolute bottom-0.5 right-0.5 w-10 text-[#8A6030]/52 sm:bottom-1 sm:right-1 sm:w-12" aria-hidden="true"><SprigIcon /></span>
          </article>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-it-works-heading" className="-mt-px scroll-mt-4 bg-[#0D0A07] px-3 pb-14 pt-7 min-[375px]:px-4 sm:px-7 sm:pb-16 sm:pt-10 md:px-10 lg:pb-20 lg:pt-11">
        <div className="mx-auto max-w-6xl">
          <h2 id="how-it-works-heading" className={`text-center text-xs uppercase !tracking-[0.08em] text-[#D4AF37] sm:text-sm ${bodyFont}`}>{t("welcome.howItWorks")}</h2>
          <div className="mt-7 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-4 md:gap-7">
            {STEP_KEYS.map((key, index) => (
              <article key={key} className="flex min-w-0 flex-col items-center px-0.5 py-3 text-center sm:px-4 sm:py-5">
                <span className="flex size-11 items-center justify-center rounded-full border border-[#D4AF37]/60 text-[#DCBB65] shadow-[0_0_24px_rgba(212,175,55,0.08)] sm:size-16" aria-hidden="true"><span className="size-5 sm:size-7">{STEP_ICONS[key]}</span></span>
                <span className="font-display-en mt-2 text-[9px] text-[#D4AF37]/85 sm:mt-3 sm:text-xs" aria-hidden="true">0{index + 1}</span>
                <h3 className={`mt-2 text-[11px] font-light leading-[1.45] text-[#FFF4DE] min-[375px]:text-xs sm:mt-3 sm:text-lg md:text-xl ${headingFont}`}>{t(`welcome.steps.${key}.title`)}</h3>
                <p className={`mt-1.5 text-[9px] font-light leading-[1.55] text-[#E8DCC7]/68 min-[375px]:text-[10px] sm:mt-2 sm:text-sm sm:leading-6 ${bodyFont}`}>{t(`welcome.steps.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
