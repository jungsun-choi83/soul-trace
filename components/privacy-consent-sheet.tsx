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
  const [wasOpen, setWasOpen] = useState(open);

  // 시트가 열리는 순간에만 확정된 값에서 다시 시작한다. 렌더 중 조정이라
  // effect 를 거치지 않고 첫 페인트부터 올바른 체크 상태로 그려진다.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(checked);
  }

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
            className="fixed inset-0 z-[300] bg-[#393129]/45 backdrop-blur-md"
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
            className={`fixed inset-x-0 bottom-0 z-[301] mx-auto flex max-h-[min(88dvh,820px)] w-full max-w-lg flex-col rounded-t-2xl border border-[#eadcc6] bg-[#fffaf0] shadow-[0_-18px_60px_rgba(57,49,41,0.18)] ${bodyFont}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
          >
            <div className="flex shrink-0 justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-[#dfceb6]" aria-hidden />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-2 sm:px-6">
              <p id="privacy-sheet-title" className="text-base font-medium leading-relaxed text-[#393129] sm:text-[17px]">
                {t(titlePath)}
              </p>
              <p className="mt-4 whitespace-pre-line text-sm leading-[1.75] text-[#594b3c] sm:text-[15px] sm:leading-[1.8]">
                {t(bodyPath)}
              </p>
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfceb6] bg-[#fff8ec] p-4">
                <input
                  type="checkbox"
                  checked={draft}
                  onChange={(e) => setDraft(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[#9e774c]"
                />
                <span className="text-sm leading-[1.7] text-[#393129] sm:text-[15px]">
                  {t(agreePath)}
                </span>
              </label>
            </div>
            <div className="shrink-0 border-t border-[#eadcc6] px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <button
                type="button"
                disabled={!draft}
                onClick={handleConfirm}
                className="min-h-[48px] w-full rounded-xl bg-[#9e774c] text-base font-medium text-[#fffaf2] transition hover:bg-[#8d6a43] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("form.privacySheetConfirm")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 min-h-[44px] w-full rounded-xl border border-[#b7a38b] text-sm text-[#594b3c] transition hover:bg-[#f1e5cf]"
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
