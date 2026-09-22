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
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa6";
import { getEternalBeamFacebookUrl, getEternalBeamInstagramUrl, getEternalBeamYoutubeUrl } from "@/lib/eternalbeam-urls";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  const { lang } = useLocale();
  const eternalBeamFacebookUrl = getEternalBeamFacebookUrl();
  const eternalBeamYoutubeUrl = getEternalBeamYoutubeUrl();

  return (
    <div className={`${lang === "ko" ? "homepage-ko-typography" : ""} min-h-[100svh] overflow-x-hidden bg-[#0b0a09] text-[#f8f2e7]`}>
      <HomepageHeader choiceHref={choiceHref} />
      <main>
        <Hero choiceHref={choiceHref} />
        <LittleMoments />
        <HowItWorks />
        <LetterPreview />
        <PetGallery />
        <EternalBeam />
        <HologramPreview />
        <ConnectionJourney />
        <LivingMemorial />
        <FinalCta choiceHref={choiceHref} />
        <KickstarterPromo />
        <section aria-label="Eternal Beam social links" className="bg-[#0b0a09] pb-20 md:pb-28">
          <div className="w-full">
            <div className="mt-5 flex items-center justify-center gap-3 px-5 text-[#D8B84C] sm:px-8" aria-hidden="true">
              <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
              <span className="font-display-en text-xs tracking-[0.2em] sm:text-sm">Follow our journey</span>
              <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-4 px-5 sm:px-8">
              <a href={getEternalBeamInstagramUrl()} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on Instagram" className="flex size-11 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_32%_100%,#FFD600_0%,#FF7A00_24%,#FF0169_48%,#D300C5_70%,#7638FA_100%)] text-white shadow-[0_5px_16px_rgba(211,0,197,0.24)] transition hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F06AA7] motion-reduce:transform-none"><FaInstagram aria-hidden="true" className="size-7" /></a>
              <a href={eternalBeamFacebookUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on Facebook" className="flex size-11 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-[0_5px_16px_rgba(24,119,242,0.22)] transition hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] motion-reduce:transform-none"><FaFacebookF aria-hidden="true" className="size-6" /></a>
              <a href={eternalBeamYoutubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on YouTube" className="flex size-11 items-center justify-center rounded-xl bg-[#FF0000] text-white transition hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3B30] motion-reduce:transform-none"><FaYoutube aria-hidden="true" className="size-7" /></a>
            </div>
          </div>
        </section>
      </main>
      <HomepageFooter />
    </div>
  );
}
