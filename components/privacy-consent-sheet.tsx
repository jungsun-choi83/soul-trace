"use client";

import { useLocale } from "@/components/locale-provider";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type PrivacyConsentSheetProps = {
  open: boolean;
  onClose: () => void;
  titlePath: string;
  bodyPath: string;
  agreePath: string;
  checked: boolean;
  onConfirm: () => void;
};

export function PrivacyConsentSheet({
  open,
  onClose,
  titlePath,
  bodyPath,
  agreePath,
  checked,
  onConfirm,
}: PrivacyConsentSheetProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const [draft, setDraft] = useState(checked);

  useEffect(() => {
    if (open) setDraft(checked);
  }, [open, checked]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleConfirm = () => {
    if (!draft) return;
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="privacy-backdrop"
            type="button"
            aria-label={t("form.privacySheetClose")}
            className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.82)] backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            key="privacy-panel"
            role="dialog"
            aria-modal
            aria-labelledby="privacy-sheet-title"
            className={`fixed inset-x-0 bottom-0 z-[301] mx-auto flex max-h-[min(88dvh,820px)] w-full max-w-lg flex-col rounded-t-2xl border border-[rgba(212,175,55,0.45)] bg-[rgba(14,12,10,0.96)] shadow-[0_-28px_120px_rgba(0,0,0,0.72)] backdrop-blur-xl ${bodyFont}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-[rgba(212,175,55,0.35)]" aria-hidden />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:px-6">
              <p id="privacy-sheet-title" className="text-base font-light leading-relaxed text-[#F5E6B8] sm:text-[17px]">
                {t(titlePath)}
              </p>
              <p className="mt-4 whitespace-pre-line text-sm font-extralight leading-[1.75] text-[#EDE4D3]/92 sm:text-[15px] sm:leading-[1.8]">
                {t(bodyPath)}
              </p>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(8,8,8,0.45)] p-4">
                <input
                  type="checkbox"
                  checked={draft}
                  onChange={(e) => setDraft(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#D4AF37]"
                />
                <span className="text-sm font-extralight leading-[1.7] text-[#F3EAD8] sm:text-[15px]">
                  {t(agreePath)}
                </span>
              </label>
            </div>
            <div className="shrink-0 border-t border-[rgba(212,175,55,0.18)] px-5 py-4 sm:px-6">
              <button
                type="button"
                disabled={!draft}
                onClick={handleConfirm}
                className="min-h-[48px] w-full rounded-xl bg-[#b89a2e] text-base font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("form.privacySheetConfirm")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-[44px] w-full rounded-xl border border-[rgba(212,175,55,0.28)] text-sm font-light text-[#EDE4D3]/88 transition hover:bg-[rgba(212,175,55,0.06)]"
              >
                {t("form.privacySheetClose")}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
