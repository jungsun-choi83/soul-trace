"use client";

import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { ArrowRightIcon } from "./icons";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function LetterPreview() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";

  return (
    <section className="relative overflow-hidden bg-[#1a1512] py-14 text-[#f8f2e7] md:py-20">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c8a24a]/10 blur-[130px]" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-[56%_44%] items-center gap-2 px-2 sm:grid-cols-[54%_46%] sm:gap-6 sm:px-8 lg:grid-cols-2 lg:gap-12">
        <div className="min-w-0">
          <Reveal className={styles.letterTextEntrance}>
            <p className="mb-2 text-[0.55rem] uppercase tracking-[0.16em] text-[#c8a24a] sm:mb-3 sm:text-[0.625rem] sm:tracking-[0.22em] lg:mb-4 lg:text-xs lg:tracking-[0.28em]">
              {t("homepage.letter.label")}
            </p>
            <h2
              className={`${display} ${styles.mobileHeadingOnDark} text-[clamp(1.2rem,5.8vw,1.75rem)] font-light leading-tight sm:text-4xl lg:text-5xl`}
            >
              {t("homepage.letter.title").split("\n").map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p
              className={`${display} mt-3 max-w-md text-[0.68rem] leading-relaxed text-[#f8f2e7]/70 sm:mt-4 sm:text-sm lg:mt-5 lg:text-base`}
            >
              {t("homepage.letter.body").split("\n").map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </p>
          </Reveal>
          <div className="mt-4 space-y-2 sm:mt-6 sm:space-y-3 lg:mt-9 lg:space-y-4">
            <Reveal delay={300} className={styles.letterMemoryEntrance}>
              <div className="rounded-lg border border-white/10 bg-black/25 p-2 sm:rounded-xl sm:p-3 lg:p-4">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-white/40 sm:text-[0.6rem] sm:tracking-[0.18em] lg:text-[0.7rem] lg:tracking-[0.22em]">
                  {t("homepage.letter.memoryLabel")}
                </p>
                <p
                  className={`${display} mt-1 text-[0.65rem] leading-snug text-white/80 sm:mt-1.5 sm:text-xs lg:text-sm`}
                >
                  {t("homepage.letter.memoryText")}
                </p>
              </div>
            </Reveal>
            <Reveal delay={500} className={styles.letterArrowEntrance}>
              <div className="flex justify-center">
                <ArrowRightIcon className="size-3 rotate-90 text-[#c8a24a] sm:size-4 lg:size-5" />
              </div>
            </Reveal>
            <Reveal delay={680} className={styles.letterResultEntrance}>
              <div className="rounded-lg border border-[#c8a24a]/25 bg-[#c8a24a]/5 p-2 sm:rounded-xl sm:p-3 lg:p-4">
                <p className="text-[0.5rem] uppercase tracking-[0.14em] text-[#c8a24a] sm:text-[0.6rem] sm:tracking-[0.18em] lg:text-[0.7rem] lg:tracking-[0.22em]">
                  {t("homepage.letter.letterLabel")}
                </p>
                <p
                  className={`${display} mt-1 text-[0.68rem] italic leading-snug text-white/90 sm:mt-1.5 sm:text-sm lg:text-base`}
                >
                  {t("homepage.letter.letterText")}
                </p>
              </div>
            </Reveal>
          </div>
        </div>

        <Reveal delay={180} className={`flex min-w-0 justify-center ${styles.letterPaperEntrance}`}>
          <div className="relative aspect-[617/862] w-full max-w-sm rotate-1 overflow-hidden rounded-sm bg-[#f3ebda] shadow-2xl transition-transform duration-500 hover:rotate-0">
            <div className={`${styles.letterPaperContent} absolute inset-0`}>
              <Image
                src={lang === "ko" ? "/images/letter.png" : "/images/letter english.png"}
                alt=""
                fill
                sizes="(max-width: 639px) 46vw, (max-width: 1023px) 38vw, 24rem"
                className="object-contain"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
