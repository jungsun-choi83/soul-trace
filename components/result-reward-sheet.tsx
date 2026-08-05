"use client";

import { useLocale } from "@/components/locale-provider";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type ResultRewardSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function ResultRewardSheet({ open, onClose }: ResultRewardSheetProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const [ctaEnabled, setCtaEnabled] = useState(false);

  const homeUrl = useMemo(() => getEternalBeamMainUrl(), []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setCtaEnabled(false);
      return;
    }
    // 모달 닫힘→리워드 열림 전환 시 터치/클릭 연속 전달(ghost click)로 즉시 이동되는 현상 방지
    const id = window.setTimeout(() => setCtaEnabled(true), 450);
    return () => window.clearTimeout(id);
  }, [open]);

  const bullets = [
    t("result.rewardFlow.bullet1"),
    t("result.rewardFlow.bullet2"),
    t("result.rewardFlow.bullet3"),
  ];

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="reward-backdrop"
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[302] bg-[rgba(0,0,0,0.82)] backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            key="reward-panel"
            role="dialog"
            aria-modal
            aria-labelledby="reward-sheet-title"
            className="fixed inset-x-0 bottom-0 z-[303] mx-auto flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col rounded-t-2xl border border-[#D4AF37]/55 bg-[rgba(16,14,12,0.96)] shadow-[0_-28px_120px_rgba(0,0,0,0.72)] backdrop-blur-xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="relative overflow-y-auto overscroll-contain px-5 pb-8 pt-6 sm:px-8 sm:pb-10 sm:pt-7">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(212,175,55,0.45)] bg-black/50 text-lg leading-none text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.12)]"
                aria-label="Close"
              >
                ×
              </button>

              <p
                id="reward-sheet-title"
                className={`${bodyFont} pr-11 text-center text-[0.7rem] font-medium uppercase tracking-[0.28em] text-[#D4AF37]/95 sm:text-xs`}
              >
                {t("result.rewardFlow.kicker")}
              </p>
              <h2
                className={`${bodyFont} mt-4 text-center text-[1.35rem] font-light leading-snug text-[#F5E6B8] sm:text-2xl sm:leading-snug`}
              >
                {t("result.rewardFlow.title")}
              </h2>

              <ul
                className={`${bodyFont} mt-8 list-outside list-disc space-y-4 pl-5 text-[15px] font-extralight leading-[1.8] text-[#EDE4D3] marker:text-[#D4AF37]/70 sm:text-base`}
              >
                {bullets.map((line, idx) => (
                  <li key={idx} className="pl-1">
                    {line}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={!ctaEnabled}
                className={`${bodyFont} mt-10 flex w-full items-center justify-center rounded-2xl bg-[#b89a2e] px-5 py-4 text-center text-[15px] font-light leading-snug text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] disabled:cursor-not-allowed disabled:opacity-55 sm:text-lg`}
                onClick={() => {
                  window.open(homeUrl, "_blank", "noopener,noreferrer");
                  onClose();
                }}
              >
                {t("result.rewardFlow.cta")}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
