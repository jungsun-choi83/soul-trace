"use client";

import { useLocale } from "@/components/locale-provider";
import { Reveal } from "./reveal";
import styles from "./homepage.module.css";

function ProjectedPet() {
  const { t } = useLocale();

  return (
    <div className="relative mx-auto aspect-video w-full overflow-hidden rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl">
      <div className="absolute inset-0 bg-gradient-to-b from-[#c8a24a]/10 via-transparent to-[#c8a24a]/5" />
      <video
        src="/videos/unsounded-play.mp4"
        poster="/homepage/eternal-beam/hologram-pet.png"
        aria-label={t("homepage.accessibility.hologramPetAlt")}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-contain"
      />
      <div
        className={`${styles.scanLines} pointer-events-none absolute inset-0 opacity-30`}
      />
    </div>
  );
}

export function HologramPreview() {
  return (
    <Reveal className="flex justify-center">
      <div className="relative w-full max-w-sm">
        <div
          className={`absolute bottom-6 left-1/2 h-16 w-40 max-w-[75%] -translate-x-1/2 rounded-full bg-[#c8a24a]/25 blur-3xl sm:bottom-8 sm:h-24 sm:w-64 ${styles.glow}`}
        />
        <ProjectedPet />
        <div className="relative mx-auto -mt-1 h-3 w-3/4 rounded-full bg-gradient-to-b from-[#241d18] to-[#0b0a09] shadow-[0_0_40px_rgba(200,162,74,0.2)] sm:-mt-2 sm:h-6" />
      </div>
    </Reveal>
  );
}
