"use client";

import { useLocale } from "@/components/locale-provider";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect, useMemo } from "react";

function EmphasizeNameInLine({ text, name }: { text: string; name: string }) {
  if (!name || !text.includes(name)) {
    return <>{text}</>;
  }
  const parts = text.split(name);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <strong className="font-semibold text-[#0f0c0a]">{name}</strong> : null}
        </Fragment>
      ))}
    </>
  );
}

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

  const bullets = useMemo(
    () =>
      [t("result.benefitModal.perkBullet1"), t("result.benefitModal.perkBullet2"), t("result.benefitModal.perkBullet3")].map(
        (line) => line.replace(/%NAME%/g, name),
      ),
    [name, t],
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="benefit-backdrop"
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.82)] backdrop-blur-md"
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
            className="fixed inset-x-0 bottom-0 z-[301] mx-auto flex max-h-[min(92dvh,920px)] w-full max-w-lg flex-col rounded-t-2xl border border-[#D4AF37]/60 bg-[rgba(18,16,14,0.92)] shadow-[0_-28px_120px_rgba(0,0,0,0.72)] backdrop-blur-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="relative overflow-y-auto overscroll-contain px-5 pb-7 pt-5 sm:px-8 sm:pb-9 sm:pt-6">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(212,175,55,0.45)] bg-black/50 text-lg leading-none text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.12)]"
                aria-label="닫기"
              >
                ×
              </button>

              <h2
                id="benefit-modal-title"
                className={`${bodyFont} pr-11 text-[1.35rem] font-light leading-snug tracking-tight text-[#F5E6B8] sm:text-2xl sm:leading-snug`}
              >
                {t("result.benefitModal.title")}
              </h2>

              <p
                className={`${bodyFont} mt-4 border-l-2 border-[#D4AF37]/70 pl-4 text-[15px] font-light leading-[1.75] text-[#EDE4D3] sm:text-base sm:leading-[1.8]`}
              >
                {t("result.benefitModal.productOneLiner")}
              </p>

              <p
                className={`${bodyFont} mt-5 text-[15px] font-extralight leading-[1.85] text-[#F3EAD8] sm:text-base sm:leading-[1.9]`}
              >
                {t("result.benefitModal.description")}
              </p>

              <div
                className={`${bodyFont} mt-7 rounded-2xl border border-[#f0e4c4]/55 bg-gradient-to-br from-[#e8d5a8] via-[#d4af37] to-[#c9a84d] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_40px_rgba(0,0,0,0.35)] sm:px-6 sm:py-6`}
              >
                <p className="text-center text-[0.95rem] font-semibold leading-snug tracking-tight text-[#1c140c] sm:text-base">
                  {t("result.benefitModal.perkBoxTitle")}
                </p>
                <ul className="mt-4 list-outside list-disc space-y-3.5 pl-5 text-[15px] font-medium leading-[1.75] text-[#1c140c] marker:text-[#6b5220] sm:text-base sm:leading-[1.82]">
                  {bullets.map((line, idx) => (
                    <li key={idx} className="pl-1">
                      <EmphasizeNameInLine text={line} name={name} />
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={getEternalBeamMainUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`${bodyFont} mt-9 flex w-full items-center justify-center rounded-2xl bg-[#1a1510] px-5 py-4 text-center text-[15px] font-medium leading-snug tracking-wide text-[#F5E6B8] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.5),0_16px_48px_rgba(0,0,0,0.45)] transition hover:bg-[#241f18] hover:text-white sm:text-lg`}
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
