"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { modeCopy, type LetterMode } from "@/lib/letter-mode";
import type {
  PetIntroProfile,
  PetGender,
  PetType,
  SelectableLetterRecipient,
} from "@/lib/pet-profile";

type PetIntroFormProps = {
  mode: LetterMode;
  questionId: PetIntroQuestionId;
  profile: PetIntroProfile;
  onChange: (patch: Partial<PetIntroProfile>) => void;
  showErrors?: boolean;
};

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];

const PET_BREEDS: Record<PetType, string[]> = {
  dog: ["maltese", "poodle", "pomeranian", "shiba-inu", "shih-tzu", "mixed-not-sure"],
  cat: ["persian", "russian-blue", "siamese", "scottish-fold", "ragdoll", "mixed-not-sure"],
  rabbit: ["lop", "dutch", "lionhead", "mixed-not-sure"],
  hamster: ["syrian", "dwarf", "roborovski", "chinese", "mixed-not-sure"],
  bird: ["parakeet", "cockatiel", "lovebird", "finch", "mixed-not-sure"],
  other: ["mixed-not-sure"],
};

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

const PET_INTRO_QUESTION_IDS = ["name", "gender", "type", "breed", "years", "recipient"] as const;
export type PetIntroQuestionId = (typeof PET_INTRO_QUESTION_IDS)[number];

export function petIntroQuestionIds(petType: PetType | ""): PetIntroQuestionId[] {
  if (petType === "other") return ["name", "gender", "type", "years", "recipient"];
  return [...PET_INTRO_QUESTION_IDS];
}

export function PetIntroForm({
  mode,
  questionId,
  profile,
  onChange,
  showErrors = false,
}: PetIntroFormProps) {
  const { t, lang, messages } = useLocale();
  const copy = modeCopy(messages, mode);
  const [customBreedSelected, setCustomBreedSelected] = useState(false);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const showRecipientDetail = profile.letterRecipient === "byName";
  const nameError = showErrors && !profile.petName.trim();
  const genderError = showErrors && !profile.petGender;
  const typeError = showErrors && !profile.petType;
  const breedError = showErrors && !profile.petBreed;
  const ageError = showErrors && !/^\d+$/.test(profile.petAge ?? "");
  const recipientError = showErrors && !profile.letterRecipient;
  const recipientDetailError = showErrors && showRecipientDetail && !profile.letterRecipientDetail.trim();
  const breedOptions = profile.petType ? PET_BREEDS[profile.petType] : ["mixed-not-sure"];
  const customBreedActive = customBreedSelected || (
    Boolean(profile.petBreed) && !breedOptions.includes(profile.petBreed ?? "")
  );

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

      {questionId === "name" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{copy.q1Label}</label>
        <input
          id="pet-name"
          type="text"
          value={profile.petNickname || profile.petName}
          onChange={(e) => onChange({ petName: e.target.value, petNickname: e.target.value })}
          placeholder={t("form.step1.q1bPlaceholder")}
          aria-invalid={nameError}
          aria-describedby={nameError ? "pet-name-error" : undefined}
          className={fieldClass(lang, nameError)}
        />
        {nameError ? errorText(t("form.validation.petNameRequired"), "pet-name-error") : null}
      </div> : null}

      {questionId === "gender" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.petGenderLabel")}</label>
        <div className="flex flex-wrap gap-2">
          {(["male", "female"] as PetGender[]).map((gender) => (
            <button
              key={gender}
              type="button"
              onClick={() => onChange({ petGender: gender })}
              className={chipClass(profile.petGender === gender, lang)}
            >
              {t(`form.step1.petGenders.${gender}`)}
            </button>
          ))}
        </div>
        {genderError ? errorText(t("form.validation.petGenderRequired"), "pet-gender-error") : null}
      </div> : null}

      {questionId === "type" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{copy.q2Label}</label>
        <div className="flex flex-wrap gap-2">
          {PET_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setCustomBreedSelected(false);
                onChange({ petType: type, petBreed: "" });
              }}
              className={chipClass(profile.petType === type, lang)}
            >
              {t(`form.step1.petTypes.${type}`)}
            </button>
          ))}
        </div>
        {typeError ? errorText(t("form.validation.petTypeRequired"), "pet-type-error") : null}
      </div> : null}

      {questionId === "breed" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q2bLabel")}</label>
        <div className="flex flex-wrap gap-2">
          {breedOptions.map((breed) => (
            <button
              key={breed}
              type="button"
              onClick={() => {
                setCustomBreedSelected(false);
                onChange({ petBreed: breed });
              }}
              className={chipClass(profile.petBreed === breed, lang)}
            >
              {t(`form.step1.petBreeds.${breed}`)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCustomBreedSelected(true);
              onChange({ petBreed: "" });
            }}
            className={chipClass(customBreedActive, lang)}
          >
            {t("form.step1.otherBreed")}
          </button>
        </div>
        {customBreedActive ? (
          <input
            id="custom-pet-breed"
            type="text"
            value={profile.petBreed ?? ""}
            onChange={(e) => onChange({ petBreed: e.target.value })}
            placeholder={t("form.step1.otherBreedPlaceholder")}
            aria-invalid={breedError}
            aria-describedby={breedError ? "pet-breed-error" : undefined}
            className={fieldClass(lang, breedError)}
          />
        ) : null}
        {breedError ? errorText(t("form.validation.petBreedRequired"), "pet-breed-error") : null}
      </div> : null}

      {questionId === "years" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{t("form.step1.q3Label")}</label>
        <input
          id="pet-age"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={profile.petAge ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "" || /^\d+$/.test(value)) onChange({ petAge: value });
          }}
          placeholder={t("form.step1.q3Placeholder")}
          aria-invalid={ageError}
          aria-describedby={ageError ? "pet-age-error" : undefined}
          className={fieldClass(lang, ageError)}
        />
        {ageError ? errorText(t("form.validation.petAgeRequired"), "pet-age-error") : null}
      </div> : null}

      {questionId === "recipient" ? <div className="space-y-2">
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
      </div> : null}
    </div>
  );
}
