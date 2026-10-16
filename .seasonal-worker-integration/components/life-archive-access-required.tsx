"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export function LifeArchiveAccessRequired() {
  const { lang, t } = useLocale();
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-5 py-16 text-[#F3EAD8]">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(212,175,55,0.14),transparent_45%)]" />
      <div className="absolute right-5 top-6 z-10 sm:right-8 sm:top-8"><LanguageToggle /></div>
      <section className={`relative z-10 w-full max-w-xl rounded-3xl border border-[#D4AF37]/30 bg-[#12100E]/90 px-6 py-10 text-center shadow-[0_0_70px_rgba(212,175,55,0.09)] sm:px-10 sm:py-12 ${lang === "ko" ? "font-ko break-keep" : "font-display-en"}`}>
        <p className="text-xs uppercase tracking-[0.3em] text-[#D4AF37]">Eternal Beam</p>
        <h1 className="mt-5 text-3xl font-light text-white sm:text-4xl">{t("lifeArchive.accessRequired.title")}</h1>
        <p className="mx-auto mt-5 max-w-md whitespace-pre-line text-sm font-extralight leading-[1.9] text-[#CFC5B6] sm:text-base">{t("lifeArchive.accessRequired.body")}</p>
        <Link href="/choose" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-xl border border-[#D4AF37]/50 px-6 py-3 text-sm font-light text-[#F5E6C8] transition hover:bg-[#D4AF37]/10">
          {t("lifeArchive.accessRequired.back")}
        </Link>
      </section>
    </main>
  );
}
