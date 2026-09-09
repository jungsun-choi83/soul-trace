"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export function PersistentLetterUnavailable() {
  const { lang, t } = useLocale();
  return (
    <main className="min-h-screen bg-black px-5 py-8 text-[#F3EAD8]">
      <div className="mx-auto flex max-w-3xl justify-end"><LanguageToggle /></div>
      <section className={`mx-auto mt-24 max-w-xl rounded-3xl border border-[#D4AF37]/25 bg-[#12100E] px-6 py-14 text-center ${lang === "ko" ? "font-ko" : "font-display-en"}`}>
        <h1 className="text-2xl font-light">{t("result.restore.errorTitle")}</h1>
        <p className="mt-4 whitespace-pre-line text-sm font-extralight leading-[1.9] text-[#AFA598]">{t("result.restore.errorBody")}</p>
        <Link href="/" className="mt-8 inline-flex min-h-12 items-center rounded-xl border border-[#D4AF37]/45 px-6 py-3 text-sm text-[#F5E6C8] hover:bg-[#D4AF37]/10">{t("result.restore.home")}</Link>
      </section>
    </main>
  );
}
