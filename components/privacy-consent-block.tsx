"use client";

import { useLocale } from "@/components/locale-provider";

type PrivacyConsentBlockProps = {
  titlePath: string;
  bodyPath: string;
  agreePath: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PrivacyConsentBlock({
  titlePath,
  bodyPath,
  agreePath,
  checked,
  onChange,
}: PrivacyConsentBlockProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  return (
    <div
      className={`rounded-xl border-[0.5px] border-[rgba(212,175,55,0.28)] bg-[rgba(212,175,55,0.04)] p-4 sm:p-5 ${bodyFont}`}
    >
      <p className="text-sm font-light leading-relaxed text-[#F5E6B8] sm:text-[15px]">
        {t(titlePath)}
      </p>
      <p className="mt-3 whitespace-pre-line text-sm font-extralight leading-[1.75] text-[#EDE4D3]/92 sm:text-[15px] sm:leading-[1.8]">
        {t(bodyPath)}
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border-[0.5px] border-[rgba(255,255,255,0.12)] bg-[rgba(8,8,8,0.35)] p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#D4AF37]"
        />
        <span className="text-sm font-extralight leading-[1.7] text-[#F3EAD8] sm:text-[15px]">
          {t(agreePath)}
        </span>
      </label>
    </div>
  );
}
