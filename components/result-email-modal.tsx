"use client";

import { useLocale } from "@/components/locale-provider";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

type Intent = "continue" | "save";

type ResultEmailModalProps = {
  open: boolean;
  intent: Intent;
  initialEmail: string;
  onClose: () => void;
  onSubmit: (email: string) => void;
};

export function ResultEmailModal({
  open,
  intent,
  initialEmail,
  onClose,
  onSubmit,
}: ResultEmailModalProps) {
  const { t, lang } = useLocale();
  const [value, setValue] = useState(initialEmail);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSubmit = () => {
    if (!emailOk) {
      setShake(true);
      window.setTimeout(() => setShake(false), 400);
      return;
    }
    onSubmit(value.trim());
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            key="email-backdrop"
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[300] bg-[rgba(0,0,0,0.85)] backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            key="email-panel"
            role="dialog"
            aria-modal
            aria-labelledby="result-email-title"
            className={`fixed inset-x-4 top-[18%] z-[301] mx-auto max-h-[min(70dvh,560px)] w-full max-w-md overflow-y-auto rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(14,12,10,0.96)] px-6 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:inset-x-auto sm:left-1/2 sm:top-[22%] sm:-translate-x-1/2 ${bodyFont}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(212,175,55,0.4)] bg-black/40 text-lg leading-none text-[#D4AF37] transition hover:bg-[rgba(212,175,55,0.1)]"
              aria-label="Close"
            >
              ×
            </button>
            <h2
              id="result-email-title"
              className="pr-10 text-lg font-light leading-snug tracking-wide text-[#F5E6B8] sm:text-xl"
            >
              {intent === "continue"
                ? t("result.emailFlow.titleContinue")
                : t("result.emailFlow.titleSave")}
            </h2>
            <p className="mt-3 text-sm font-extralight leading-relaxed text-[#C4B8A8]">
              {t("result.emailFlow.hint")}
            </p>
            <label className="mt-6 block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="email"
                placeholder={t("result.emailFlow.placeholder")}
                className={`w-full rounded-xl border bg-black/40 px-4 py-3.5 text-base font-extralight text-[#F3EAD8] outline-none transition placeholder:text-[#6b6560] focus:border-[#D4AF37] ${
                  shake
                    ? "border-amber-500/70 ring-1 ring-amber-500/40"
                    : "border-[rgba(212,175,55,0.35)]"
                }`}
              />
            </label>
            {!emailOk && value.length > 0 ? (
              <p className="mt-2 text-xs text-amber-200/90">{t("result.emailFlow.invalid")}</p>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              className="mt-6 w-full rounded-2xl bg-[#b89a2e] px-5 py-3.5 text-center text-base font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24]"
            >
              {t("result.emailFlow.submit")}
            </button>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
