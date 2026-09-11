"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export function PartnerEntryFallback() {
  const { lang, t } = useLocale();
  const font = lang === "ko" ? "font-ko" : "font-display-en";

  return (
    <main className={`flex min-h-screen items-center justify-center bg-black px-6 text-[#F3EAD8] ${font}`}>
      <div className="w-full max-w-md text-center">
        <div className="flex justify-end"><LanguageToggle /></div>
        <p className="mt-10 text-xs uppercase tracking-[0.3em] text-[#D4AF37]">Soul Trace</p>
        <h1 className="mt-5 text-3xl text-[#FFF9EC]">{t("partnerEntry.unavailableTitle")}</h1>
        <p className="mt-4 leading-7 text-[#E8D6B4]">{t("partnerEntry.unavailableBody")}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-[#D4AF37] px-7 text-[#FFF4DE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]"
        >
          {t("partnerEntry.backToWelcome")}
        </Link>
      </div>
    </main>
  );
}
