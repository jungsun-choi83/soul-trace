"use client";

import { useLocale } from "@/components/locale-provider";
import { allPrivacyItemsAgreed, requiredPrivacyItemsAgreed, type PrivacySectionKey, type PrivacySelections } from "@/lib/privacy-consent-selection";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

type Props = { selections: PrivacySelections; onSelectionChange: (key: PrivacySectionKey, checked: boolean) => void; onAgreeAll: (checked: boolean) => void; onBack: () => void; onConfirm: () => void };
const CONSENTS: PrivacySectionKey[] = ["privacy", "marketing", "aiImprovement"];

export function QuestionnairePrivacyNotice({ selections, onSelectionChange, onAgreeAll, onBack, onConfirm }: Props) {
  const { lang, t } = useLocale();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const font = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const requiredAgreed = requiredPrivacyItemsAgreed(selections);
  const allAgreed = allPrivacyItemsAgreed(selections);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onBack(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  return <AnimatePresence><motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-questionnaire-privacy-modal>
    <motion.section role="dialog" aria-modal="true" aria-labelledby="questionnaire-privacy-title" className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#D4AF37]/55 bg-[#100E0C] shadow-[0_0_80px_rgba(212,175,55,0.12)] sm:max-h-[calc(100dvh-3rem)] ${font}`} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}>
      <header className="relative shrink-0 border-b border-[#D4AF37]/20 px-5 py-5 sm:px-7">
        <button ref={closeButtonRef} type="button" onClick={onBack} aria-label={t("form.consents.close")} className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full text-2xl text-[#D4AF37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]">×</button>
        <h2 id="questionnaire-privacy-title" className="pr-12 text-xl font-extralight leading-relaxed text-white md:text-2xl">{t("form.consents.title")}</h2>
        <p className="mt-3 text-sm font-extralight leading-[1.8] text-[#D8D0C4]">{t("form.consents.helper")}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7">
        {CONSENTS.map((key) => <ConsentCheckbox key={key} sectionKey={key} checked={selections[key]} label={t(`form.consents.${key}`)} onChange={(checked) => onSelectionChange(key, checked)} />)}
        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-[#D4AF37] underline underline-offset-4">{t("form.consents.policyLink")}</a>
      </div>
      <footer className="shrink-0 border-t border-[#D4AF37]/25 bg-[#100E0C] px-5 py-4 sm:px-7">
        <label className="flex w-fit cursor-pointer items-center gap-3 border-t border-[#D4AF37]/15 pt-4 text-left text-sm text-[#F3EAD8]"><input type="checkbox" checked={allAgreed} onChange={(event) => onAgreeAll(event.target.checked)} className="h-5 w-5 accent-[#D4AF37]" /><span>{t("form.consents.agreeAll")}</span></label>
        {!requiredAgreed ? <p role="alert" className="mt-3 text-xs text-red-200">{t("form.consents.requiredError")}</p> : null}
        <button type="button" disabled={!requiredAgreed} onClick={onConfirm} className="mt-4 min-h-[44px] w-full rounded-xl bg-[#b89a2e] text-black transition hover:bg-[#a88928] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]">{t("form.consents.continue")}</button>
      </footer>
    </motion.section>
  </motion.div></AnimatePresence>;
}

function ConsentCheckbox({ sectionKey, checked, label, onChange }: { sectionKey: PrivacySectionKey; checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  const id = `privacy-${sectionKey}`;
  return <label htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#D4AF37]/30 p-4 text-sm font-extralight leading-[1.8] text-[#EDE4D3] focus-within:border-[#D4AF37] sm:p-5" data-privacy-section={sectionKey}><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[#D4AF37]" /><span>{label}</span></label>;
}
