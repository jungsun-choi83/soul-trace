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
import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa6";
import { getEternalBeamInstagramUrl, getEternalBeamTiktokUrl, getEternalBeamYoutubeUrl } from "@/lib/eternalbeam-urls";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  const { lang } = useLocale();
  const eternalBeamTiktokUrl = getEternalBeamTiktokUrl();
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
        <section aria-label="Eternal Beam Kickstarter" className="bg-[#0b0a09] px-5 pb-20 sm:px-8 md:pb-28">
          <div className="mx-auto w-full max-w-5xl">
            <div className="relative aspect-[192/103] w-full overflow-hidden bg-black">
              <Image
                src={lang === "ko" ? "/images/kickstarter-ko-v2.png" : "/images/kickstarter-v2.png"}
                alt={lang === "ko" ? "Eternal Beam Kickstarter 출시 안내" : "Eternal Beam Kickstarter launch announcement"}
                width={1536}
                height={1024}
                sizes="(max-width: 1024px) calc(100vw - 40px), 1024px"
                className="absolute inset-x-0 top-0 h-auto w-full"
              />
            </div>
            <div className="mt-5 flex items-center justify-center gap-3 text-[#D8B84C]" aria-hidden="true">
              <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
              <span className="font-display-en text-xs tracking-[0.2em] sm:text-sm">Follow our journey</span>
              <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
            </div>
            <div className="mt-3 flex items-center justify-center gap-4">
              <a href={getEternalBeamInstagramUrl()} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on Instagram" className="flex size-11 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_32%_100%,#FFD600_0%,#FF7A00_24%,#FF0169_48%,#D300C5_70%,#7638FA_100%)] text-white shadow-[0_5px_16px_rgba(211,0,197,0.24)] transition hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F06AA7] motion-reduce:transform-none"><FaInstagram aria-hidden="true" className="size-7" /></a>
              <a href={eternalBeamTiktokUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on TikTok" className="flex size-11 items-center justify-center rounded-xl border border-white/15 bg-[#010101] text-white transition hover:scale-105 hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25F4EE] motion-reduce:transform-none"><FaTiktok aria-hidden="true" className="size-6" /></a>
              <a href={eternalBeamYoutubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on YouTube" className="flex size-11 items-center justify-center rounded-xl bg-[#FF0000] text-white transition hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3B30] motion-reduce:transform-none"><FaYoutube aria-hidden="true" className="size-7" /></a>
            </div>
          </div>
        </section>
      </main>
      <HomepageFooter />
    </div>
  );
}
