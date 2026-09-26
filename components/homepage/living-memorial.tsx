"use client";

import { useLocale } from "@/components/locale-provider";
import { StarIcon, SunIcon } from "./icons";
import { Reveal } from "./reveal";

export function LivingMemorial() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const cards = [
    [SunIcon, "living", false],
    [StarIcon, "memorial", true],
  ] as const;

  return (
    <section className="bg-[#f8f2e7] pb-10 pt-14 text-[#1a1512] md:pb-14 md:pt-20">
      <div className="mx-auto max-w-6xl px-2 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="mb-3 text-[0.6rem] uppercase tracking-[0.2em] text-[#c8a24a] sm:mb-4 sm:text-xs sm:tracking-[0.28em]">
              {t("homepage.livingMemorial.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className={`${display} text-[clamp(1.45rem,7vw,1.875rem)] font-light leading-tight sm:text-4xl`}
            >
              {t("homepage.livingMemorial.title")}
            </h2>
          </Reveal>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-10 sm:gap-5">
          {cards.map(([Icon, key, dark], index) => (
            <Reveal
              key={key}
              delay={index * 80}
              className={`min-w-0 overflow-hidden rounded-2xl p-3 sm:rounded-3xl sm:p-10 ${
                dark
                  ? "bg-[#1a1512] text-[#f8f2e7]"
                  : "border border-[#1a1512]/10 bg-[#f3ebda]"
              }`}
            >
              <div className="grid size-9 place-items-center rounded-full bg-[#c8a24a]/10 text-[#c8a24a] sm:size-12">
                <Icon className="size-4 sm:size-5" />
              </div>
              <h3
                className={`${display} mt-3 text-[clamp(0.9rem,4.5vw,1.5rem)] leading-snug sm:mt-6 sm:text-2xl`}
              >
                {t(`homepage.livingMemorial.${key}Title`)}
              </h3>
              <p
                className={`${display} mt-2 text-[clamp(0.7rem,2.3vw,1rem)] leading-relaxed sm:mt-3 ${
                  dark ? "text-white/70" : "text-[#1a1512]/65"
                }`}
              >
                {t(`homepage.livingMemorial.${key}Body`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
