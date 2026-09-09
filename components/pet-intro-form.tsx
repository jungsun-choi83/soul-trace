"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { modeCopy, type LetterMode } from "@/lib/letter-mode";
import type {
  PetIntroProfile,
  PetType,
  SelectableLetterRecipient,
} from "@/lib/pet-profile";

type PetIntroFormProps = {
  mode: LetterMode;
  profile: PetIntroProfile;
  onChange: (patch: Partial<PetIntroProfile>) => void;
  showErrors?: boolean;
};

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];

const RECIPIENTS: SelectableLetterRecipient[] = [
  "mom",
  "dad",
  "both",
  "sister",
  "brother",
  "byName",
];

function fieldClass(lang: Locale, invalid = false) {
  return `w-full rounded-xl border-[0.5px] bg-transparent px-4 py-3 text-base font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 md:text-sm ${
    lang === "ko" ? "font-ko" : "font-display-en"
  } ${invalid ? "border-red-300/75 focus:border-red-300" : "border-[rgba(212,175,55,0.35)] focus:border-[#D4AF37]"}`;
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

export function PetIntroForm({ mode, profile, onChange, showErrors = false }: PetIntroFormProps) {
  const { t, lang, messages } = useLocale();
  const copy = modeCopy(messages, mode);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const showRecipientDetail = profile.letterRecipient === "byName";
  const currentYear = new Date().getFullYear();
  const yearMet = Number.parseInt(profile.yearMet, 10);
  const yearParted = Number.parseInt(profile.yearParted, 10);
  const nameError = showErrors && !profile.petName.trim();
  const typeError = showErrors && !profile.petType;
  const yearsMissing = showErrors && (!profile.yearMet.trim() || !profile.yearParted.trim());
  const yearsOutOfRange =
    showErrors &&
    !yearsMissing &&
    (!Number.isFinite(yearMet) || !Number.isFinite(yearParted) || yearMet < 1980 ||
      yearParted < 1980 || yearMet > currentYear || yearParted > currentYear);
  const yearsReversed = showErrors && !yearsMissing && !yearsOutOfRange && yearMet > yearParted;
  const yearsError = yearsMissing || yearsOutOfRange || yearsReversed;
  const recipientError = showErrors && !profile.letterRecipient;
  const recipientDetailError = showErrors && showRecipientDetail && !profile.letterRecipientDetail.trim();

  const errorText = (message: string, id: string) => (
    <p id={id} className="text-xs font-extralight leading-relaxed text-red-200" role="alert">
      {message}
    </p>
  );

  return (
    <div className={`space-y-5 ${bodyFont}`}>
      <p className="step-kicker">
        {t("form.step1.kicker")}
      </p>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{copy.q1Label}</label>
        <input
          id="pet-name"
          type="text"
          value={profile.petName}
          onChange={(e) => onChange({ petName: e.target.value })}
          placeholder={t("form.step1.q1Placeholder")}
          aria-invalid={nameError}
          aria-describedby={nameError ? "pet-name-error" : undefined}
          className={fieldClass(lang, nameError)}
        />
        {nameError ? errorText(t("form.validation.petNameRequired"), "pet-name-error") : null}
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
        <label className="text-sm font-extralight text-[#F3EAD8]">{copy.q2Label}</label>
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
        {typeError ? errorText(t("form.validation.petTypeRequired"), "pet-type-error") : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q3Label")}</label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input
            id="year-met"
            type="number"
            inputMode="numeric"
            min={1980}
            max={currentYear}
            value={profile.yearMet}
            onChange={(e) => onChange({ yearMet: e.target.value })}
            placeholder={t("form.step1.yearMetPlaceholder")}
            aria-invalid={yearsError}
            aria-describedby={yearsError ? "years-error" : undefined}
            className={fieldClass(lang, yearsError)}
          />
          <span className="text-[#D4AF37]/80">~</span>
          <input
            id="year-parted"
            type="number"
            inputMode="numeric"
            min={1980}
            max={currentYear}
            value={profile.yearParted}
            onChange={(e) => onChange({ yearParted: e.target.value })}
            placeholder={copy.yearPartedPlaceholder}
            aria-invalid={yearsError}
            aria-describedby={yearsError ? "years-error" : undefined}
            className={fieldClass(lang, yearsError)}
          />
        </div>
        {yearsMissing
          ? errorText(t("form.validation.yearsRequired"), "years-error")
          : yearsOutOfRange
            ? errorText(t("form.validation.yearsRange"), "years-error")
            : yearsReversed
              ? errorText(t("form.validation.yearsOrder"), "years-error")
              : null}
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
                    recipient === "byName" ? profile.letterRecipientDetail : "",
                })
              }
              className={chipClass(profile.letterRecipient === recipient, lang)}
            >
              {t(`form.step1.recipients.${recipient}`)}
            </button>
          ))}
        </div>
        {recipientError ? errorText(t("form.validation.recipientRequired"), "recipient-error") : null}
        {showRecipientDetail ? (
          <>
            <input
              id="recipient-detail"
              type="text"
              value={profile.letterRecipientDetail}
              onChange={(e) => onChange({ letterRecipientDetail: e.target.value })}
              placeholder={t("form.step1.recipientByNamePlaceholder")}
              aria-invalid={recipientDetailError}
              aria-describedby={recipientDetailError ? "recipient-detail-error" : undefined}
              className={fieldClass(lang, recipientDetailError)}
            />
            {recipientDetailError
              ? errorText(t("form.validation.recipientDetailRequired"), "recipient-detail-error")
              : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
