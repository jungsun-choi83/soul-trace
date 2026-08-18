"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import type { LetterRecipient, PetIntroProfile, PetType } from "@/lib/pet-profile";

type PetIntroFormProps = {
  profile: PetIntroProfile;
  onChange: (patch: Partial<PetIntroProfile>) => void;
};

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];

const RECIPIENTS: LetterRecipient[] = ["mom", "dad", "both", "sibling", "byName", "custom"];

function fieldClass(lang: Locale) {
  return `w-full rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-transparent px-4 py-3 text-base font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 focus:border-[#D4AF37] md:text-sm ${
    lang === "ko" ? "font-ko" : "font-display-en"
  }`;
}

function chipClass(selected: boolean, lang: Locale) {
  return `min-h-[40px] rounded-xl border px-3 py-2 text-sm font-light transition ${
    lang === "ko" ? "font-ko" : "font-display-en"
  } ${
    selected
      ? "border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.14)] text-[#F5E6B8]"
      : "border-[rgba(212,175,55,0.28)] bg-transparent text-[#EDE4D3]/88 hover:border-[rgba(212,175,55,0.45)] hover:bg-[rgba(212,175,55,0.06)]"
  }`;
}

export function PetIntroForm({ profile, onChange }: PetIntroFormProps) {
  const { t, lang } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const showRecipientDetail =
    profile.letterRecipient === "byName" || profile.letterRecipient === "custom";
  const currentYear = new Date().getFullYear();

  return (
    <div className={`space-y-5 ${bodyFont}`}>
      <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37]/90">
        {t("form.step1.kicker")}
      </p>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q1Label")}</label>
        <input
          type="text"
          value={profile.petName}
          onChange={(e) => onChange({ petName: e.target.value })}
          placeholder={t("form.step1.q1Placeholder")}
          className={fieldClass(lang)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q1bLabel")}</label>
        <input
          type="text"
          value={profile.petNickname}
          onChange={(e) => onChange({ petNickname: e.target.value })}
          placeholder={t("form.step1.q1bPlaceholder")}
          className={fieldClass(lang)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q2Label")}</label>
        <div className="flex flex-wrap gap-2">
          {PET_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onChange({ petType: type })}
              className={chipClass(profile.petType === type, lang)}
            >
              {t(`form.step1.petTypes.${type}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q3Label")}</label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1980}
            max={currentYear}
            value={profile.yearMet}
            onChange={(e) => onChange({ yearMet: e.target.value })}
            placeholder={t("form.step1.yearMetPlaceholder")}
            className={fieldClass(lang)}
          />
          <span className="text-[#D4AF37]/80">~</span>
          <input
            type="number"
            inputMode="numeric"
            min={1980}
            max={currentYear}
            value={profile.yearParted}
            onChange={(e) => onChange({ yearParted: e.target.value })}
            placeholder={t("form.step1.yearPartedPlaceholder")}
            className={fieldClass(lang)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q4Label")}</label>
        <div className="flex flex-wrap gap-2">
          {RECIPIENTS.map((recipient) => (
            <button
              key={recipient}
              type="button"
              onClick={() =>
                onChange({
                  letterRecipient: recipient,
                  letterRecipientDetail:
                    recipient === "byName" || recipient === "custom"
                      ? profile.letterRecipientDetail
                      : "",
                })
              }
              className={chipClass(profile.letterRecipient === recipient, lang)}
            >
              {t(`form.step1.recipients.${recipient}`)}
            </button>
          ))}
        </div>
        {showRecipientDetail ? (
          <input
            type="text"
            value={profile.letterRecipientDetail}
            onChange={(e) => onChange({ letterRecipientDetail: e.target.value })}
            placeholder={
              profile.letterRecipient === "byName"
                ? t("form.step1.recipientByNamePlaceholder")
                : t("form.step1.recipientCustomPlaceholder")
            }
            className={fieldClass(lang)}
          />
        ) : null}
      </div>
    </div>
  );
}
