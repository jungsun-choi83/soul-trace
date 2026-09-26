"use client";

import { ConnectionJourney } from "@/components/homepage/connection-journey";
import { EternalBeam } from "@/components/homepage/eternal-beam";
import { FinalCta } from "@/components/homepage/final-cta";
import { Hero } from "@/components/homepage/hero";
import { HologramPreview } from "@/components/homepage/hologram-preview";
import { HomepageFooter } from "@/components/homepage/homepage-footer";
import { HomepageHeader } from "@/components/homepage/homepage-header";
import { HowItWorks } from "@/components/homepage/how-it-works";
import { KickstarterPromo } from "@/components/homepage/kickstarter-promo";
import { LetterPreview } from "@/components/homepage/letter-preview";
import { LittleMoments } from "@/components/homepage/little-moments";
import { LivingMemorial } from "@/components/homepage/living-memorial";
import { PetGallery } from "@/components/homepage/pet-gallery";
import { useLocale } from "@/components/locale-provider";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  const { lang } = useLocale();

  return (
    <div className={`${lang === "ko" ? "homepage-ko-typography" : ""} min-h-[100svh] overflow-x-hidden bg-[#0b0a09] text-[#f8f2e7]`}>
      <HomepageHeader choiceHref={choiceHref} />
      <main>
        <Hero choiceHref={choiceHref} />
        <LittleMoments />
        <HowItWorks />
        <LetterPreview />
        <PetGallery />
        <EternalBeam
          product={<HologramPreview />}
          features={<ConnectionJourney />}
        />
        <LivingMemorial />
        <FinalCta choiceHref={choiceHref} />
        <KickstarterPromo />
      </main>
      <HomepageFooter />
    </div>
  );
}
