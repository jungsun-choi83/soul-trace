"use client";

import { useLocale } from "@/components/locale-provider";
import { MailIcon, PenIcon, SparklesIcon } from "./icons";
import { Reveal } from "./reveal";

export function HowItWorks() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const steps = [
    [PenIcon, "share"],
    [MailIcon, "receive"],
    [SparklesIcon, "discover"],
  ] as const;

  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 bg-[#f8f2e7] py-14 text-[#1a1512] md:py-20"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-[#c8a24a]">
              {t("homepage.howItWorks.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className={`${display} text-[1.6875rem] font-light sm:text-5xl`}
            >
              {t("homepage.howItWorks.title")}
            </h2>
          </Reveal>
        </div>

        <div className="relative mt-10 grid grid-cols-3 gap-[clamp(0.25rem,1.5vw,2rem)]">
          <div className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-5 h-px bg-gradient-to-r from-transparent via-[#c8a24a]/40 to-transparent sm:top-7 md:top-8">
            {["25%", "75%"].map((position) => (
              <span
                key={position}
                className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-t border-[#c8a24a]/50 sm:size-2"
                style={{ left: position }}
              />
            ))}
          </div>

          {steps.map(([Icon, key], index) => (
            <Reveal
              key={key}
              delay={index * 70}
              className="relative min-w-0 text-center"
            >
              <div className="relative z-10 mx-auto grid size-10 place-items-center rounded-full border border-[#c8a24a]/30 bg-[#f3ebda] sm:size-14 md:size-16">
                <Icon className="size-4 text-[#c8a24a] sm:size-5 md:size-6" />
                <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#1a1512] text-[0.55rem] text-[#f8f2e7] sm:-right-1 sm:-top-1 sm:size-5 sm:text-[0.625rem] md:size-6 md:text-xs">
                  {index + 1}
                </span>
              </div>
              <h3
                className={`${display} mt-3 text-[clamp(0.7rem,2.5vw,1.5rem)] leading-snug sm:mt-5 md:mt-6`}
              >
                {t(`homepage.howItWorks.${key}Title`)}
              </h3>
              <p
                className={`${display} mx-auto mt-2 max-w-xs text-[clamp(0.625rem,1.4vw,0.875rem)] leading-relaxed text-[#1a1512]/65 sm:mt-3`}
              >
                {t(`homepage.howItWorks.${key}Body`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
