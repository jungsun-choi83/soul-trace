"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export function WelcomeExperience({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();

  return (
    <main
      className="relative isolate flex h-[92svh] min-h-[32rem] overflow-hidden bg-black bg-cover bg-center px-6 py-6 md:px-10 md:py-10"
      style={{ backgroundImage: "url('/images/soul-trace-hero-poster.jpg')" }}
    >
      <video
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center motion-reduce:hidden"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/images/soul-trace-hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/videos/soul-trace-hero-smooth.mp4" type="video/mp4" />
      </video>

      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.48)_0%,rgba(0,0,0,0.08)_34%,rgba(0,0,0,0.32)_60%,rgba(0,0,0,0.88)_100%)]"
        aria-hidden="true"
      />

      <header className="flex w-full items-start justify-between">
        <p className="font-display-en pt-1 text-sm uppercase tracking-[0.3em] text-[#F3EAD8] sm:text-base">
          Soul Trace
        </p>
        <LanguageToggle />
      </header>

      <section className="absolute inset-x-6 bottom-6 md:inset-x-10 md:bottom-10">
        <div className="max-w-xl">
          <h1
            className={`text-[#FFF9EC] drop-shadow-[0_2px_20px_rgba(0,0,0,0.72)] ${
              lang === "ko"
                ? "font-ko break-keep text-[2.35rem] font-light leading-[1.3] tracking-[-0.02em] sm:text-5xl"
                : "font-display-en text-[2.5rem] leading-[1.12] tracking-[0.04em] sm:text-5xl"
            }`}
          >
            {t("welcome.title")}
          </h1>

          <Link
            href={choiceHref}
            className={`mt-8 inline-flex min-h-14 min-w-60 items-center justify-center rounded-full bg-[#F3EAD8] px-8 py-4 text-center text-[15px] text-[#17130E] shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition hover:bg-[#FFF9EC] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3EAD8] sm:text-base ${
              lang === "ko" ? "font-ko-medium" : "font-display-en tracking-[0.08em]"
            }`}
          >
            {t("welcome.cta")}
          </Link>
        </div>
      </section>
    </main>
  );
}
