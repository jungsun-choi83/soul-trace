"use client";

import { useLocale } from "@/components/locale-provider";
import { useEffect, useRef, useState } from "react";
import { LuGem, LuMail, LuPencil } from "react-icons/lu";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

export function HowItWorks() {
  const { lang, t } = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const [progressStarted, setProgressStarted] = useState(false);
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const steps = [
    [LuPencil, "share"],
    [LuMail, "receive"],
    [LuGem, "discover"],
  ] as const;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setProgressStarted(true);
          observer.unobserve(section);
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="scroll-mt-20 bg-[#f8f2e7] py-14 text-[#1a1512] md:py-20"
    >
      <div className="mx-auto max-w-7xl px-2 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal className={styles.howTextEntrance}>
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.28em] text-[#c8a24a]">
              {t("homepage.howItWorks.label")}
            </p>
            <h2
              className={`${display} ${styles.mobileHeadingOnLight} text-[1.6875rem] font-light sm:text-5xl`}
            >
              {t("homepage.howItWorks.title")}
            </h2>
          </Reveal>
        </div>

        <div
          className={`relative mt-10 grid grid-cols-3 gap-[clamp(0.25rem,1.5vw,2rem)] ${progressStarted ? styles.howProgressActive : ""}`}
        >
          <div className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-5 h-px bg-gradient-to-r from-transparent via-[#c8a24a]/40 to-transparent sm:top-7 md:top-8">
            <span className={`${styles.howConnectorFill} ${styles.howConnectorFillOne}`} />
            <span className={`${styles.howConnectorFill} ${styles.howConnectorFillTwo}`} />
          </div>

          {steps.map(([Icon, key], index) => (
            <div
              key={key}
              className={`relative min-w-0 text-center ${styles.howStep} ${index === 0 ? styles.howStepOne : index === 1 ? styles.howStepTwo : styles.howStepThree}`}
            >
              <div className={`relative z-10 mx-auto grid size-10 place-items-center rounded-full border border-[#c8a24a]/30 bg-[#f3ebda] sm:size-14 md:size-16 ${styles.howStepCircle}`}>
                <Icon aria-hidden="true" strokeWidth={1.9} className={`size-5 text-[#a77d28] sm:size-7 md:size-8 ${styles.howStepIcon} ${index === 2 ? styles.howResultIcon : ""}`} />
                <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-[#1a1512] text-[0.55rem] text-[#f8f2e7] sm:-right-1 sm:-top-1 sm:size-5 sm:text-[0.625rem] md:size-6 md:text-xs">
                  {index + 1}
                </span>
              </div>
              <h3
                className={`${display} mt-3 min-h-[2.75em] text-[clamp(0.7rem,2.5vw,1.5rem)] leading-snug sm:mt-5 md:mt-6 md:min-h-0 ${styles.howStepTitle}`}
              >
                {t(`homepage.howItWorks.${key}Title`)}
              </h3>
              <p
                className={`${display} mx-auto mt-2 max-w-xs text-[clamp(0.625rem,1.4vw,0.875rem)] leading-relaxed text-[#1a1512]/65 sm:mt-3 ${styles.howStepDescription}`}
              >
                {t(`homepage.howItWorks.${key}Body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
