"use client";

import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { Reveal } from "./reveal";

export function LittleMoments() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const cards = [
    ["sleep", "/homepage/moments/moment-sleep.png", "w-[33%]", "-rotate-4", "left-0 top-[12%]", "z-10"],
    ["wait", "/homepage/moments/moment-wait.png", "w-[34%]", "rotate-1", "left-[30%] top-[20%]", "z-20"],
    ["bond", "/homepage/moments/moment-bond.png", "w-[33%]", "rotate-4", "right-[4%] top-[10%]", "z-10"],
  ] as const;

  return (
    <section className="bg-[#f3ebda] py-14 text-[#1a1512] md:py-20">
      <div className="mx-auto grid max-w-7xl grid-cols-[45%_55%] items-center gap-3 px-3 sm:grid-cols-[42%_58%] sm:gap-8 sm:px-8 lg:gap-12">
        <div className="min-w-0">
          <Reveal>
            <p className="mb-3 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-[#c8a24a] sm:mb-4 sm:text-xs sm:tracking-[0.28em]">
              {t("homepage.moments.label")}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className={`${display} whitespace-pre-line text-[clamp(1.25rem,6vw,2rem)] font-light leading-tight sm:text-4xl lg:text-5xl`}
            >
              {t("homepage.moments.title")}
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p
              className={`${display} mt-4 max-w-sm whitespace-pre-line text-xs leading-relaxed text-[#1a1512]/65 sm:mt-5 sm:text-sm lg:text-base`}
            >
              {t("homepage.moments.body")}
            </p>
          </Reveal>
        </div>

        <div className="relative h-[220px] min-w-0 sm:h-[300px] lg:h-[360px]">
          {cards.map(([key, src, width, rotation, position, layer], index) => (
            <Reveal
              key={key}
              delay={index * 70}
              className={`group absolute ${width} ${position} ${layer} ${rotation}`}
            >
              <div className="relative rounded-sm bg-[#f8f2e7] p-1.5 pb-6 shadow-[0_10px_24px_rgba(67,48,29,0.18)] sm:p-3 sm:pb-10">
                <div className="relative aspect-square overflow-hidden">
                  <Image
                    src={src}
                    alt={t(
                      `homepage.accessibility.moment${key[0].toUpperCase()}${key.slice(1)}Alt`,
                    )}
                    fill
                    sizes="(max-width: 639px) 25vw, (max-width: 1023px) 26vw, 22vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                {(key === "sleep" || key === "bond") && (
                  <span className="absolute -top-1 left-1/2 h-3 w-10 -translate-x-1/2 rotate-2 bg-[#d6c7a5]/75 shadow-sm sm:-top-2 sm:h-5 sm:w-14" />
                )}
              </div>
            </Reveal>
          ))}
          <span className="absolute bottom-[8%] right-[24%] z-30 rotate-12 font-serif text-xl text-[#c8a24a]/70 sm:text-3xl">
            ♡
          </span>
        </div>
      </div>
    </section>
  );
}
