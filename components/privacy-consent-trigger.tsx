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
      className={`flex w-full items-center justify-between gap-3 rounded-xl border border-[#dfceb6] bg-[#fff8ec] px-4 py-3.5 text-left transition hover:border-[#9e774c]/55 hover:bg-[#f1e5cf] ${bodyFont}`}
    >
      <span className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] ${
            agreed
              ? "border-[#9e774c] bg-[#9e774c] text-[#fffaf2]"
              : "border-[#b7a38b] bg-[#fffaf0] text-transparent"
          }`}
          aria-hidden
        >
          ✓
        </span>
        <span className="text-sm leading-relaxed text-[#393129] sm:text-[15px]">
          {t(labelPath)}
          {agreed ? (
            <span className="mt-1 block text-xs text-[#9e774c]">{t("form.privacyConsentAgreed")}</span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-xs font-medium text-[#9e774c]">{t("form.privacyConsentView")}</span>
    </button>
  );
}
