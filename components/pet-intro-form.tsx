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
  questionId: PetIntroQuestionId;
  profile: PetIntroProfile;
  onChange: (patch: Partial<PetIntroProfile>) => void;
  showErrors?: boolean;
};

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];

const PET_BREEDS: Record<PetType, string[]> = {
  dog: ["golden-retriever", "labrador-retriever", "poodle", "maltese", "pomeranian", "shih-tzu", "chihuahua", "jindo", "mixed-not-sure"],
  cat: ["korean-shorthair", "persian", "russian-blue", "siamese", "british-shorthair", "scottish-fold", "ragdoll", "mixed-not-sure"],
  rabbit: ["lop", "dutch", "lionhead", "netherland-dwarf", "mixed-not-sure"],
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

const PET_INTRO_QUESTION_IDS = ["name", "type", "breed", "years", "recipient"] as const;
export type PetIntroQuestionId = (typeof PET_INTRO_QUESTION_IDS)[number];

const PET_INTRO_DISPLAY_NUMBER: Record<PetIntroQuestionId, string> = {
  name: "Q1",
  type: "Q2.a",
  breed: "Q2.b",
  years: "Q3",
  recipient: "Q4",
};

function numberedLabel(questionId: PetIntroQuestionId, label: string): string {
  return `${PET_INTRO_DISPLAY_NUMBER[questionId]}. ${label}`;
}

export function petIntroQuestionIds(petType: PetType | ""): PetIntroQuestionId[] {
  return petType === "other"
    ? PET_INTRO_QUESTION_IDS.filter((id) => id !== "breed")
    : [...PET_INTRO_QUESTION_IDS];
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
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const showRecipientDetail = profile.letterRecipient === "byName";
  const nameError = showErrors && !profile.petName.trim();
  const typeError = showErrors && !profile.petType;
  const breedError = showErrors && !profile.petBreed;
  const ageError = showErrors && !/^\d+$/.test(profile.petAge ?? "");
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

      {questionId === "name" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{numberedLabel("name", copy.q1Label)}</label>
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

      {questionId === "type" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{numberedLabel("type", copy.q2Label)}</label>
        <div className="flex flex-wrap gap-2">
          {PET_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
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
        <label className="text-sm font-extralight text-[#F3EAD8]">{numberedLabel("breed", t("form.step1.q2bLabel"))}</label>
        <div className="flex flex-wrap gap-2">
          {(profile.petType ? PET_BREEDS[profile.petType] : ["mixed-not-sure"]).map((breed) => (
            <button
              key={breed}
              type="button"
              onClick={() => onChange({ petBreed: breed })}
              className={chipClass(profile.petBreed === breed, lang)}
            >
              {t(`form.step1.petBreeds.${breed}`)}
            </button>
          ))}
        </div>
        {breedError ? errorText(t("form.validation.petBreedRequired"), "pet-breed-error") : null}
      </div> : null}

      {questionId === "years" ? <div className="space-y-2">
        <label className="text-sm font-extralight text-[#F3EAD8]">{numberedLabel("years", t("form.step1.q3Label"))}</label>
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
        <label className="text-sm font-extralight text-[#F3EAD8]">{numberedLabel("recipient", t("form.step1.q4Label"))}</label>
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
