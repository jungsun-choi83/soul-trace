"use client";

import { EternalBeamLogo } from "@/components/storybook/eternal-beam-logo";
import { useLocale } from "@/components/locale-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { petFirstCopy } from "@/lib/pet-first-archive";
import { UIUX_WELCOME_ART } from "@/lib/uiux-art";
import Image from "next/image";
import Link from "next/link";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  void choiceHref;
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const body = lang === "ko" ? "font-ko break-keep" : "font-display-en";

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#3a2c1e] text-[#463021]">
      <Image
        src={UIUX_WELCOME_ART}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_22%]"
      />
      <div className="absolute inset-x-0 top-0 z-10 flex justify-end px-4 pt-[max(0.6rem,env(safe-area-inset-top))]">
        <LanguageToggle tone="paper" />
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
        <section className="mx-auto w-full max-w-[400px] rounded-[28px] border border-[#e4d2b4] bg-[#fff7ea]/96 px-6 py-7 text-center shadow-[0_18px_40px_rgba(70,48,33,0.22)]">
          <EternalBeamLogo className="mx-auto h-auto w-[9.5rem]" />
          <p className="mt-3 font-display-en text-[2rem] leading-none tracking-[0.04em] text-[#463021]">SoulTrace</p>
          <h1 className={`mt-4 text-[15px] leading-7 text-[#5c4633] ${body}`}>{copy.welcomeKeep}</h1>
          <Link href="/dashboard" className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-full bg-[#5a3d27] text-base text-[#fff7ea] ${body}`}>
            {copy.welcomeStartCta}
          </Link>
          <Link href="/auth?returnTo=/dashboard&mode=signin" className={`mt-4 inline-flex min-h-11 items-center text-sm text-[#5a3d27] underline decoration-[#cbb58e] underline-offset-4 ${body}`}>
            {copy.welcomeLogin}
          </Link>
          <Link href="/create" className={`mt-2 block text-xs text-[#8a7460] ${body}`}>
            {copy.welcomePolaroid}
          </Link>
        </section>
      </div>
    </div>
  );
}
