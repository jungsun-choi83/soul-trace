"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import {
  PET_PHOTO_ACCEPT,
  validatePetPhotoFile,
  type PetPhotoValidationError,
} from "@/lib/pet-photo";

type PetPhotoUploadProps = {
  petDisplayName: string;
  previewUrl: string | null;
  onFileChange: (file: File | null) => void;
};

export function PetPhotoUpload({ petDisplayName, previewUrl, onFileChange }: PetPhotoUploadProps) {
  const { t, lang } = useLocale();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorKey, setErrorKey] = useState<PetPhotoValidationError | null>(null);

  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const hint = t("survey.video.photoHint").replace(/○○/g, petDisplayName.trim());

  const applyFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setErrorKey(null);
        onFileChange(null);
        return;
      }
      const err = validatePetPhotoFile(file);
      if (err) {
        setErrorKey(err);
        return;
      }
      setErrorKey(null);
      onFileChange(file);
    },
    [onFileChange],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    applyFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    applyFile(file);
  };

  const errorMessage =
    errorKey === "size"
      ? t("survey.video.photoErrorSize")
      : errorKey === "type"
        ? t("survey.video.photoErrorType")
        : errorKey === "empty"
          ? t("survey.video.photoErrorEmpty")
          : null;

  return (
    <div className={bodyFont}>
      <p className="font-display-en text-[10px] uppercase tracking-[0.28em] text-[#D4AF37]/90">
        {t("survey.video.photoKicker")}
      </p>
      <p className="mt-3 text-sm font-extralight leading-relaxed text-[#EDE4D3] sm:text-[15px]">
        {hint}
      </p>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PET_PHOTO_ACCEPT}
        className="sr-only"
        onChange={onInputChange}
      />

      {previewUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.28)] bg-[rgba(8,8,8,0.45)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={t("survey.video.photoPreviewAlt").replace(/○○/g, petDisplayName.trim())}
            className="mx-auto max-h-64 w-full object-contain object-center"
          />
          <div className="flex flex-wrap gap-2 border-t border-[rgba(212,175,55,0.18)] px-4 py-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="min-h-[40px] rounded-xl border border-[rgba(212,175,55,0.35)] px-3 py-2 text-sm font-light text-[#EDE4D3]/90 transition hover:border-[rgba(212,175,55,0.55)] hover:bg-[rgba(212,175,55,0.06)]"
            >
              {t("survey.video.photoChange")}
            </button>
            <button
              type="button"
              onClick={() => applyFile(null)}
              className="min-h-[40px] rounded-xl border border-[rgba(255,255,255,0.12)] px-3 py-2 text-sm font-light text-[#C4B8A8] transition hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.04)]"
            >
              {t("survey.video.photoRemove")}
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${
            dragOver
              ? "border-[rgba(212,175,55,0.65)] bg-[rgba(212,175,55,0.1)]"
              : "border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.03)] hover:border-[rgba(212,175,55,0.55)] hover:bg-[rgba(212,175,55,0.06)]"
          }`}
        >
          <span className="text-2xl text-[#D4AF37]/75" aria-hidden>
            +
          </span>
          <span className="mt-3 text-sm font-light text-[#EDE4D3]">{t("survey.video.photoDrop")}</span>
          <span className="mt-2 text-xs font-extralight text-[#A8A29E]">
            {t("survey.video.photoFormats")}
          </span>
        </label>
      )}

      {errorMessage ? (
        <p className="mt-3 text-xs font-extralight leading-relaxed text-amber-200/90" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
