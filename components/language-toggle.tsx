"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale, t } = useLocale();

  const segment = (value: Locale, label: string) => {
    const active = locale === value;
    return (
      <button
        type="button"
        onClick={() => setLocale(value)}
        className={`min-w-[2.75rem] px-2 py-1.5 text-[11px] tracking-[0.18em] transition ${
          active
            ? "bg-[#D4AF37] text-black"
            : "bg-transparent text-[#F3EAD8] hover:text-[#D4AF37]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="font-display-en fixed top-4 right-4 z-[200] flex items-center gap-0 rounded-lg border border-[rgba(212,175,55,0.55)] bg-[#141210]/95 px-1 py-0.5 shadow-[0_8px_40px_rgba(0,0,0,0.65)] backdrop-blur-md md:top-6 md:right-6"
      aria-label="Language"
    >
      {segment("ko", t("languageToggle.kr"))}
      <span className="text-[#D4AF37]/50" aria-hidden>
        |
      </span>
      {segment("en", t("languageToggle.en"))}
    </div>
  );
}
