"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { modeCopy, type LetterMode } from "@/lib/letter-mode";
import type { ServiceChannel } from "@/lib/service-channel";
import { PetPhotoUpload } from "@/components/pet-photo-upload";
import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import {
  formatSurveyName,
  channelMemoryQuestions,
  memoryQuestionCount,
  PET_PHOTO_UPLOAD_ENABLED,
  PHOTO_STEP_COUNT,
  type LetterTonePrefs,
} from "@/lib/survey";

type SurveyFlowProps = {
  mode: LetterMode;
  serviceChannel?: ServiceChannel | null;
  step: number;
  petDisplayName: string;
  memoryAnswers: string[];
  tonePrefs: LetterTonePrefs;
  petPhotoPreviewUrl: string | null;
  onPetPhotoChange: (file: File | null) => void;
  onSkipPhoto: () => void;
  photoPrivacyConsent: boolean;
  onOpenPhotoPrivacy: () => void;
  onMemoryChange: (index: number, value: string) => void;
  onToneMood: (mood: LetterTonePrefs["mood"]) => void;
  onToneLength: (length: LetterTonePrefs["length"]) => void;
  onSkipOptional: () => void;
  showValidationError?: boolean;
};

function chipClass(selected: boolean, lang: Locale) {
  return `min-h-[40px] rounded-xl border px-3 py-2 text-sm font-light transition ${
    lang === "ko" ? "font-ko" : "font-display-en"
  } ${
    selected
      ? "border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.14)] text-[#F5E6B8]"
      : "border-[rgba(212,175,55,0.28)] bg-transparent text-[#EDE4D3]/88 hover:border-[rgba(212,175,55,0.45)] hover:bg-[rgba(212,175,55,0.06)]"
  }`;
}

export function SurveyFlow({
  mode,
  serviceChannel = null,
  step,
  petDisplayName,
  memoryAnswers,
  tonePrefs,
  petPhotoPreviewUrl,
  onPetPhotoChange,
  onSkipPhoto,
  photoPrivacyConsent,
  onOpenPhotoPrivacy,
  onMemoryChange,
  onToneMood,
  onToneLength,
  onSkipOptional,
  showValidationError = false,
}: SurveyFlowProps) {
  const { t, lang, messages } = useLocale();
  const copy = modeCopy(messages, mode);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const channelMemory = channelMemoryQuestions(messages, serviceChannel);
  const memoryCount = memoryQuestionCount(serviceChannel);
  const isPhoto = PET_PHOTO_UPLOAD_ENABLED && step === memoryCount + 1;
  const isMemory = step < memoryCount;
  const memoryItem = isMemory ? (channelMemory?.[step] ?? copy.memory[step]) : null;
  const toneIndex = step === memoryCount ? 0 : step - memoryCount - PHOTO_STEP_COUNT;
  const toneItem = !isMemory && !isPhoto ? copy.tone[toneIndex] : null;
  const validationMessage = !showValidationError
    ? null
    : isPhoto
      ? petPhotoPreviewUrl && !photoPrivacyConsent
        ? t("form.validation.photoConsentRequired")
        : t("form.validation.photoChoiceRequired")
      : isMemory && !memoryItem?.optional && !(memoryAnswers[step] ?? "").trim()
        ? t("form.validation.memoryRequired")
        : toneItem?.id === "q10" && !tonePrefs.mood
          ? t("form.validation.moodRequired")
          : toneItem?.id === "q12" && !tonePrefs.length
            ? t("form.validation.lengthRequired")
            : null;

  return (
    <div className={bodyFont}>
      <p className="step-kicker">
        {isPhoto ? t("survey.stampPhoto.label") : isMemory ? t("survey.memoryKicker") : t("survey.toneKicker")}
      </p>

      {isPhoto ? (
        <div className="mt-4 space-y-4">
          <p className="survey-hint font-extralight text-[#D4AF37]/85">{t("survey.stampPhoto.helper")}</p>
          <PetPhotoUpload
            petDisplayName={petDisplayName}
            previewUrl={petPhotoPreviewUrl}
            onFileChange={onPetPhotoChange}
            showKicker={false}
            showGuidance={false}
          />
          {petPhotoPreviewUrl ? (
            <PrivacyConsentTrigger
              agreed={photoPrivacyConsent}
              onOpen={onOpenPhotoPrivacy}
              labelPath="form.photoPrivacyConsentLink"
            />
          ) : null}
          <button
            type="button"
            onClick={onSkipPhoto}
            className={`w-full rounded-xl border border-dashed border-[rgba(212,175,55,0.35)] px-4 py-3 text-sm font-light text-[#D4AF37]/90 transition hover:border-[rgba(212,175,55,0.55)] hover:bg-[rgba(212,175,55,0.06)] ${bodyFont}`}
          >
            {t("survey.video.photoSkip")}
          </button>
        </div>
      ) : null}

      {isMemory && memoryItem ? (
        <div className="mt-4 space-y-4">
          <p className="text-xl font-extralight leading-relaxed text-[#FFFFFF] md:text-2xl">
            {`Q${step + 1}. ${formatSurveyName(memoryItem.promptText, petDisplayName)}`}
          </p>
          {memoryItem.optional ? (
            <p className="survey-hint font-extralight text-[#C4B8A8]/90">
              {memoryItem.optionalNote}
            </p>
          ) : (
            <p className="survey-hint font-extralight text-[#D4AF37]/85">{t("survey.memoryHint")}</p>
          )}
          {memoryItem.example ? (
            <p className="survey-hint font-extralight leading-relaxed text-[#A8A29E]">
              {t("survey.examplePrefix")} {memoryItem.example}
            </p>
          ) : null}
          <textarea
            value={memoryAnswers[step] ?? ""}
            onChange={(e) => onMemoryChange(step, e.target.value)}
            placeholder={memoryItem.placeholder}
            rows={5}
            className="font-ko w-full resize-none rounded-2xl border-[0.5px] border-[rgba(212,175,55,0.28)] bg-transparent p-4 text-base font-extralight leading-7 text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/45 focus:border-[#D4AF37] md:text-base"
          />
          {memoryItem.optional ? (
            <button
              type="button"
              onClick={onSkipOptional}
              className={`w-full rounded-xl border border-dashed border-[rgba(212,175,55,0.35)] px-4 py-3 text-sm font-light text-[#D4AF37]/90 transition hover:border-[rgba(212,175,55,0.55)] hover:bg-[rgba(212,175,55,0.06)] ${bodyFont}`}
            >
              {memoryItem.skipLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {!isMemory && !isPhoto && toneItem ? (
        <div className="mt-4 space-y-4">
          <p className="text-xl font-extralight leading-relaxed text-[#FFFFFF] md:text-2xl">
            {`${toneItem.id === "q10" ? "Q1" : "Q2"}. ${toneItem.promptText.replace(/^Q\d+\.\s*/, "")}`}
          </p>
          <div className="flex flex-wrap gap-2">
            {toneItem.id === "q10"
              ? toneItem.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onToneMood(opt.id as LetterTonePrefs["mood"])}
                    className={chipClass(tonePrefs.mood === opt.id, lang)}
                  >
                    {opt.label}
                  </button>
                ))
              : null}
            {toneItem.id === "q12"
              ? toneItem.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onToneLength(opt.id as LetterTonePrefs["length"])}
                    className={chipClass(tonePrefs.length === opt.id, lang)}
                  >
                    {opt.label}
                  </button>
                ))
              : null}
          </div>
        </div>
      ) : null}
      {validationMessage ? (
        <p className="mt-4 text-xs font-extralight leading-relaxed text-red-200" role="alert">
          {validationMessage}
        </p>
      ) : null}
    </div>
  );
}
