"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";

/**
 * KO | EN 전환. 활성 #D4AF37, 비활성 그레이. 부모에서 우측 정렬(flex justify-end)로 둡니다.
 */
export function LanguageToggle() {
  const { lang, setLang } = useLocale();

  const segment = (value: Locale, label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        className={`px-2 py-1 text-[13px] font-medium tracking-wide transition sm:text-[14px] ${
          active ? "text-[#D4AF37]" : "text-[#6b6b6b] hover:text-[#a3a3a3]"
        } `}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="font-display-en inline-flex items-center rounded-md border border-[#D4AF37]/55 bg-black/90 px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(212,175,55,0.12)]"
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
