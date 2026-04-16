"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

type LanguageToggleProps = {
  /** 문서 흐름에 두어 랜딩 등에서 항상 보이게 할 때 */
  inline?: boolean;
};

export function LanguageToggle({ inline = false }: LanguageToggleProps) {
  const { locale, setLocale, t } = useLocale();

  const segment = (value: Locale, label: string) => {
    const active = locale === value;
    return (
      <button
        type="button"
        onClick={() => setLocale(value)}
        className={`min-w-[3rem] px-3 py-2 text-[12px] tracking-[0.18em] transition sm:min-w-[2.75rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
          active
            ? "bg-[#D4AF37] text-black"
            : "bg-transparent text-[#F3EAD8] hover:text-[#D4AF37]"
        }`}
      >
        {label}
      </button>
    );
  };

  const shell =
    "font-display-en flex items-center gap-0 rounded-lg border border-[rgba(212,175,55,0.55)] bg-[#141210]/95 px-0.5 py-0.5 shadow-[0_8px_40px_rgba(0,0,0,0.65)] backdrop-blur-md";

  return (
    <div
      className={
        inline
          ? shell
          : `${shell} fixed top-4 right-4 z-[200] md:top-6 md:right-6`
      }
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
