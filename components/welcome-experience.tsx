"use client";

import { ConnectionJourney } from "@/components/homepage/connection-journey";
import { EternalBeam } from "@/components/homepage/eternal-beam";
import { FinalCta } from "@/components/homepage/final-cta";
import { Hero } from "@/components/homepage/hero";
import { HologramPreview } from "@/components/homepage/hologram-preview";
import { HomepageFooter } from "@/components/homepage/homepage-footer";
import { HomepageHeader } from "@/components/homepage/homepage-header";
import { HowItWorks } from "@/components/homepage/how-it-works";
import { LetterPreview } from "@/components/homepage/letter-preview";
import { LittleMoments } from "@/components/homepage/little-moments";
import { LivingMemorial } from "@/components/homepage/living-memorial";
import { PetGallery } from "@/components/homepage/pet-gallery";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  return (
    <div className="min-h-[100svh] overflow-x-hidden bg-[#0b0a09] text-[#f8f2e7]">
      <HomepageHeader choiceHref={choiceHref} />
      <main>
        <Hero choiceHref={choiceHref} />
        <LittleMoments />
        <HowItWorks />
        <LetterPreview />
        <PetGallery />
        <EternalBeam />
        <HologramPreview choiceHref={choiceHref} />
        <ConnectionJourney />
        <LivingMemorial />
        <FinalCta choiceHref={choiceHref} />
      </main>
      <HomepageFooter />
    </div>
  );
}
