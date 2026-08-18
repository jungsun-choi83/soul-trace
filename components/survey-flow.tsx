"use client";

import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { PetPhotoUpload } from "@/components/pet-photo-upload";
import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import { VideoMotionPicker } from "@/components/video-motion-picker";
import {
  formatSurveyName,
  isPhotoSurveyStep,
  MEMORY_STEP_COUNT,
  OPTIONAL_MEMORY_STEP,
  SURVEY_STEP_COUNT,
  type LetterToneOption,
  type LetterTonePrefs,
  type VideoMotion,
} from "@/lib/survey";

type SurveyFlowProps = {
  step: number;
  petDisplayName: string;
  memoryAnswers: string[];
  tonePrefs: LetterTonePrefs;
  petPhotoPreviewUrl: string | null;
  onPetPhotoChange: (file: File | null) => void;
  onSkipPhoto: () => void;
  photoPrivacyConsent: boolean;
  onOpenPhotoPrivacy: () => void;
  videoMotion: VideoMotion | "";
  onVideoMotionChange: (motion: VideoMotion) => void;
  onMemoryChange: (index: number, value: string) => void;
  onToneMood: (mood: LetterTonePrefs["mood"]) => void;
  onToneOptionToggle: (option: LetterToneOption) => void;
  onToneLength: (length: LetterTonePrefs["length"]) => void;
  onSkipOptional: () => void;
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
  step,
  petDisplayName,
  memoryAnswers,
  tonePrefs,
  petPhotoPreviewUrl,
  onPetPhotoChange,
  onSkipPhoto,
  photoPrivacyConsent,
  onOpenPhotoPrivacy,
  videoMotion,
  onVideoMotionChange,
  onMemoryChange,
  onToneMood,
  onToneOptionToggle,
  onToneLength,
  onSkipOptional,
}: SurveyFlowProps) {
  const { t, lang, messages } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const isPhoto = isPhotoSurveyStep(step);
  const isMemory = step < MEMORY_STEP_COUNT;
  const memoryItem = isMemory ? messages.survey.memory[step] : null;
  const toneIndex = step - MEMORY_STEP_COUNT - 1;
  const toneItem = !isMemory && !isPhoto ? messages.survey.tone[toneIndex] : null;

  return (
    <div className={bodyFont}>
      <div className="mb-6 flex items-center justify-between text-xs">
        <span className="font-display-en uppercase text-[#D4AF37]">
          {t("questionHeader.label")} {step + 1}
        </span>
        <span className="font-display-en text-[#D4AF37]">{SURVEY_STEP_COUNT}</span>
      </div>
      <div className="mb-4 h-px overflow-hidden rounded-full bg-[rgba(243,234,216,0.12)]">
        <div
          className="h-full rounded-full bg-[#D4AF37] transition-all duration-700 ease-out"
          style={{ width: `${((step + 1) / SURVEY_STEP_COUNT) * 100}%` }}
        />
      </div>

      <p className="step-kicker">
        {isPhoto ? t("survey.photoStepKicker") : isMemory ? t("survey.memoryKicker") : t("survey.toneKicker")}
      </p>

      {isPhoto ? (
        <div className="mt-4 space-y-4">
          <PetPhotoUpload
            petDisplayName={petDisplayName}
            previewUrl={petPhotoPreviewUrl}
            onFileChange={onPetPhotoChange}
            showKicker={false}
          />
          {petPhotoPreviewUrl ? (
            <PrivacyConsentTrigger
              agreed={photoPrivacyConsent}
              onOpen={onOpenPhotoPrivacy}
              labelPath="form.photoPrivacyConsentLink"
            />
          ) : null}
          <VideoMotionPicker
            petDisplayName={petDisplayName}
            value={videoMotion}
            onChange={onVideoMotionChange}
            disabled={!petPhotoPreviewUrl || !photoPrivacyConsent}
            embedded
          />
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
            {formatSurveyName(memoryItem.promptText, petDisplayName)}
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
          {step === OPTIONAL_MEMORY_STEP ? (
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
            {toneItem.promptText}
          </p>
          {toneItem.id === "q11" ? (
            <p className="survey-hint font-extralight text-[#D4AF37]/85">{t("survey.toneMultiHint")}</p>
          ) : null}
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
            {toneItem.id === "q11"
              ? toneItem.options.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm font-extralight leading-relaxed transition ${
                      tonePrefs.options.includes(opt.id as LetterToneOption)
                        ? "border-[rgba(212,175,55,0.55)] bg-[rgba(212,175,55,0.1)] text-[#F5E6B8]"
                        : "border-[rgba(212,175,55,0.22)] bg-transparent text-[#EDE4D3]/90 hover:border-[rgba(212,175,55,0.4)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={tonePrefs.options.includes(opt.id as LetterToneOption)}
                      onChange={() => onToneOptionToggle(opt.id as LetterToneOption)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#D4AF37]"
                    />
                    <span>{opt.label}</span>
                  </label>
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
    </div>
  );
}
