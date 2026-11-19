"use client";

import { useLocale } from "@/components/locale-provider";

type PrivacyConsentTriggerProps = {
  agreed: boolean;
  onOpen: () => void;
  labelPath: string;
};

export function PrivacyConsentTrigger({ agreed, onOpen, labelPath }: PrivacyConsentTriggerProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-[#d9c2b0] bg-[#f6ebe3] px-4 py-3.5 text-left transition hover:border-[#55603a]/55 hover:bg-[#ead6c4] ${bodyFont}`}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
            agreed
              ? "border-[#55603a] bg-[#55603a] text-[#f6ebe3]"
              : "border-[#8aabbc] bg-[#e7f0f4] text-transparent"
          }`}
          aria-hidden
        >
          ✓
        </span>
        <span className="text-sm leading-relaxed text-[#1e4d3a] sm:text-[15px]">
          {t(labelPath)}
          {agreed ? (
            <span className="mt-1 block text-xs text-[#3e6274]">{t("form.privacyConsentAgreed")}</span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium text-[#3e6274]">{t("form.privacyConsentView")}</span>
    </button>
  );
}
