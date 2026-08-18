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
      className={`flex w-full items-center justify-between gap-3 rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.04)] px-4 py-3.5 text-left transition hover:border-[rgba(212,175,55,0.55)] hover:bg-[rgba(212,175,55,0.08)] ${bodyFont}`}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
            agreed
              ? "border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.2)] text-[#F5E6B8]"
              : "border-[rgba(212,175,55,0.35)] bg-transparent text-transparent"
          }`}
          aria-hidden
        >
          ✓
        </span>
        <span className="text-sm font-extralight leading-relaxed text-[#F3EAD8] sm:text-[15px]">
          {t(labelPath)}
          {agreed ? (
            <span className="mt-1 block text-xs text-[#D4AF37]/85">{t("form.privacyConsentAgreed")}</span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-xs font-light text-[#D4AF37]">{t("form.privacyConsentView")}</span>
    </button>
  );
}
