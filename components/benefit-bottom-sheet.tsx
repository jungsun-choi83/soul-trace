"use client";

import { useLocale } from "@/components/locale-provider";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

type BenefitBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 반려 이름 — 혜택 문구에 삽입 */
  petDisplayName: string;
};

export function BenefitBottomSheet({ open, onClose, petDisplayName }: BenefitBottomSheetProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const name =
    petDisplayName.trim().length > 0
      ? petDisplayName.trim()
      : t("result.benefitModal.nameFallback");

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="benefit-backdrop"
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.8)] backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            key="benefit-panel"
            role="dialog"
            aria-modal
            aria-labelledby="benefit-modal-title"
            className="fixed inset-x-0 bottom-0 z-[301] mx-auto flex max-h-[min(92dvh,900px)] w-full max-w-lg flex-col rounded-t-2xl border border-[#D4AF37]/55 bg-[rgba(24,22,18,0.78)] shadow-[0_-24px_100px_rgba(0,0,0,0.65)] backdrop-blur-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="relative overflow-y-auto overscroll-contain px-5 pb-6 pt-4 sm:px-7 sm:pb-8 sm:pt-5">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(212,175,55,0.4)] bg-black/40 text-lg leading-none text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.08)]"
                aria-label="닫기"
              >
                ×
              </button>

              <h2
                id="benefit-modal-title"
                className={`${bodyFont} pr-10 pt-1 text-xl font-light leading-snug text-[#D4AF37] sm:text-2xl`}
              >
                {t("result.benefitModal.title")}
              </h2>

              <p
                className={`${bodyFont} mt-5 text-sm font-extralight leading-relaxed text-[#F3EAD8] sm:text-base`}
              >
                {t("result.benefitModal.description")}
              </p>

              <div
                className={`${bodyFont} mt-6 rounded-xl border border-[#D4AF37]/40 bg-[rgba(212,175,55,0.06)] px-4 py-4 text-sm font-light leading-relaxed text-[#F3EAD8] sm:text-[15px]`}
              >
                {t("result.benefitModal.perkBefore")}
                <strong className="font-medium text-[#D4AF37]">{name}</strong>
                {t("result.benefitModal.perkAfter")}
              </div>

              <a
                href="https://eternalbeam.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`${bodyFont} mt-8 flex w-full items-center justify-center rounded-2xl bg-[#b89a2e] px-5 py-4 text-center text-base font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] sm:text-lg`}
                onClick={onClose}
              >
                {t("result.benefitModal.reserveCta")}
              </a>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
