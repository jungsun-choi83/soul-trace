"use client";

import { useLocale } from "@/components/locale-provider";
import {
  HeartIcon,
  InfinityIcon,
  PenIcon,
  SparklesIcon,
} from "./icons";
import { Reveal } from "./reveal";

export function ConnectionJourney() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const steps = [
    [HeartIcon, "photos", false],
    [SparklesIcon, "easy", false],
    [PenIcon, "design", true],
    [InfinityIcon, "lasting", true],
  ] as const;

  return (
    <div id="about" className="scroll-mt-20">
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-3">
        {steps.map(([Icon, key, highlight], index) => (
          <Reveal
            key={key}
            delay={index * 30}
            className="relative flex min-w-0 items-center gap-1.5"
          >
            <div
              className={`grid size-6 shrink-0 place-items-center rounded-full border sm:size-8 ${
                highlight
                  ? "border-[#c8a24a] bg-[#c8a24a]/15 text-[#c8a24a] shadow-[0_0_18px_rgba(200,162,74,0.2)]"
                  : "border-white/20 bg-black/20 text-white/70"
              }`}
            >
              <Icon className="size-3 sm:size-3.5" />
            </div>
            <span
              className={`${display} min-w-0 text-[0.52rem] leading-tight text-white/80 sm:text-[0.65rem] lg:text-xs`}
            >
              {t(`homepage.eternalBeam.benefits.${key}`)}
            </span>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
