"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export function EternalBeamAccessError() {
  const { t, locale } = useLocale();
  return (
    <main className={`min-h-screen bg-black px-6 py-20 text-center ${locale === "ko" ? "font-ko" : "font-display-en"}`}>
      <div className="mx-auto max-w-lg rounded-2xl border border-[#D4AF37]/25 bg-[#12100d] px-7 py-12">
        <p className="whitespace-pre-line text-base font-light leading-[1.9] text-[#F3EAD8]">
          {t("lifeArchive.accessHandoffError.body")}
        </p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center text-sm text-[#D4AF37] underline underline-offset-4">
          {t("lifeArchive.accessRequired.back")}
        </Link>
      </div>
    </main>
  );
}
