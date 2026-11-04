"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

/**
 * KO | EN 전환. 활성 #D4AF37, 비활성 그레이. 부모에서 우측 정렬(flex justify-end)로 둡니다.
 */
export function LanguageToggle({ tone = "night", compact = false }: { tone?: "night" | "paper"; compact?: boolean }) {
  const { lang, setLang } = useLocale();
  const paper = tone === "paper";

  const segment = (value: Locale, label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        aria-pressed={active}
        className={`${compact ? "min-h-11 px-1.5 text-[12px]" : "min-h-9 px-2 py-1 text-[13px] sm:text-[14px]"} font-medium tracking-wide transition ${
          paper
            ? active ? "text-[#7a5f48]" : "text-[#9a8b7c] hover:text-[#6b5d50]"
            : active ? "text-[#D4AF37]" : "text-[#6b6b6b] hover:text-[#a3a3a3]"
        } `}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={paper
        ? `font-display-en !tracking-[0.04em] inline-flex shrink-0 items-center rounded-full border border-[#7a5f48]/25 bg-[#fbf6ec]/90 ${compact ? "px-1" : "px-1.5 py-0.5"}`
        : "font-display-en inline-flex shrink-0 items-center rounded-md border border-[#D4AF37]/55 bg-black/90 px-1 py-0.5 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)] sm:px-1.5"}
      role="group"
      aria-label="Language"
    >
      {segment("ko", "KO")}
      <span className="select-none text-[12px] text-[#4a4a4a]" aria-hidden>
        |
      </span>
      {segment("en", "EN")}
    </div>
  );
}
