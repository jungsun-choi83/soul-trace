"use client";

import { BenefitBottomSheet } from "@/components/benefit-bottom-sheet";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { toBlob, toPng } from "html-to-image";
import { useEffect, useRef, useState } from "react";

type GeneratedResult = {
  personalityType: string;
  personalitySummary: string;
  letter: string;
  heroImageUrl: string | null;
  /** DALL·E 단계 실패 또는 URL 없음 — 편지(GPT)는 성공했을 수 있음 */
  heroImageSkipped?: boolean;
};

/** 첫 그래프클러스터(드롭캡)와 나머지 본문 분리 — 선행 공백은 유지 */
function splitLetterForDropCap(letter: string): { first: string; rest: string } {
  const trimmed = letter.trimStart();
  const leading = letter.slice(0, letter.length - trimmed.length);
  if (!trimmed) {
    return { first: "", rest: letter };
  }
  const graphemes =
    typeof Intl !== "undefined" && "Segmenter" in Intl
      ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed)].map(
          (s) => s.segment,
        )
      : [...trimmed];
  const first = graphemes[0] ?? "";
  const restBody = graphemes.slice(1).join("");
  return { first, rest: leading + restBody };
}

function getCaptureOptions(locale: Locale, skipFonts: boolean, pixelRatio = 2) {
  return {
    cacheBust: true,
    pixelRatio,
    backgroundColor: "#000000",
    skipFonts,
    useCORS: true,
  } as const;
}

const HERO_EYEBROW: Record<Locale, string> = {
  ko: "이터널빔",
  en: "Eternal Beam",
};

export default function Home() {
  const { lang, t, messages } = useLocale();
  const questions = messages.questions;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => Array(questions.length).fill(""));
  const [userEmail, setUserEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [preferredScenery, setPreferredScenery] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareableFile, setShareableFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [benefitModalOpen, setBenefitModalOpen] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result) return;
    if (!result.heroImageUrl) {
      setHeroLoaded(true);
      return;
    }
    setHeroLoaded(false);
  }, [result]);

  const isLastQuestion = step === questions.length - 1;
  const isAnswerValid = answers[step]?.trim().length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
  const isProfileValid =
    isEmailValid && petName.trim().length > 0 && preferredScenery.trim().length > 0 && privacyConsent;

  const handleChangeAnswer = (value: string) => {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
  };

  const goNext = () => {
    if (!isAnswerValid) return;
    setStep((prev) => Math.min(prev + 1, questions.length - 1));
  };

  const goPrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const submitAnswers = async () => {
    if (!answers.every((answer) => answer.trim())) {
      setError(t("errors.fillAll"));
      return;
    }
    if (!isProfileValid) {
      setError(t("errors.profileIncomplete"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = questions.map((question, index) => ({
        question: question.promptText,
        answer: answers[index].trim(),
      }));

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: lang,
          userEmail: userEmail.trim(),
          petName: petName.trim(),
          preferredScenery: preferredScenery.trim(),
          privacyConsent,
          answers: payload,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? t("errors.generateFailed"));
      }

      const data = (await response.json()) as GeneratedResult;
      setResult({
        ...data,
        heroImageUrl: data.heroImageUrl ?? null,
        heroImageSkipped: data.heroImageSkipped === true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
    } finally {
      setIsLoading(false);
    }
  };

  const captureToPng = async (skipFonts: boolean, pixelRatio = 2) => {
    if (!captureRef.current) return "";
    return toPng(captureRef.current, getCaptureOptions(lang, skipFonts, pixelRatio));
  };

  const captureToBlob = async (skipFonts: boolean, pixelRatio = 2) => {
    if (!captureRef.current) return null;
    return toBlob(captureRef.current, getCaptureOptions(lang, skipFonts, pixelRatio));
  };

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    try {
      setError(null);
      let dataUrl: string;
      try {
        dataUrl = await captureToPng(false, 3);
      } catch {
        dataUrl = await captureToPng(true, 3);
      }
      const anchor = document.createElement("a");
      anchor.download = "soul-trace-letter.png";
      anchor.href = dataUrl;
      anchor.click();
    } catch (err) {
      setError(
        err instanceof Error
          ? `${t("errors.saveImageFailed")} ${err.message}`
          : t("errors.saveImageGeneric"),
      );
    }
  };

  const prepareInstagramShare = async () => {
    if (!captureRef.current) return;
    setIsSharing(true);
    setError(null);
    try {
      let blob: Blob | null;
      try {
        blob = await captureToBlob(false);
      } catch {
        blob = await captureToBlob(true);
      }
      if (!blob) {
        throw new Error(t("errors.blobFailed"));
      }
      const file = new File([blob], "soul-trace-letter.png", { type: "image/png" });
      setShareableFile(file);
    } catch (err) {
      setShareableFile(null);
      setError(err instanceof Error ? err.message : t("errors.prepareShareFailed"));
    } finally {
      setIsSharing(false);
    }
  };

  const openInstagramShare = () => {
    if (!shareableFile) return;
    setError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        if (navigator.canShare?.({ files: [shareableFile] })) {
          void navigator.share({
            title: t("share.title"),
            text: t("share.text"),
            files: [shareableFile],
          });
          return;
        }
      }
      const url = URL.createObjectURL(shareableFile);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "soul-trace-letter.png";
      anchor.click();
      URL.revokeObjectURL(url);
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.shareFailed"));
    }
  };

  const onInstagramButtonClick = () => {
    if (shareableFile) {
      openInstagramShare();
      return;
    }
    void prepareInstagramShare();
  };

  const resetTest = () => {
    setStep(0);
    setAnswers(Array(questions.length).fill(""));
    setUserEmail("");
    setPetName("");
    setPreferredScenery("");
    setPrivacyConsent(false);
    setResult(null);
    setShareableFile(null);
    setError(null);
    setBenefitModalOpen(false);
  };

  const q = questions[step];

  const canCaptureArtwork = !result?.heroImageUrl || heroLoaded;

  if (result) {
    const { first: dropCap, rest: letterRest } = splitLetterForDropCap(result.letter);

    return (
      <>
        <main className="min-h-screen bg-black pb-10">
          <header className="flex w-full justify-end px-4 pt-6 sm:px-6">
            <LanguageToggle />
          </header>
          <section className="mx-auto w-full max-w-3xl space-y-8 px-4 sm:px-6">
            <div
              ref={captureRef}
              className="relative min-h-[100vh] w-full overflow-hidden rounded-sm shadow-[0_0_80px_rgba(212,175,55,0.12)]"
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                {result.heroImageUrl ? (
                  <img
                    src={result.heroImageUrl}
                    alt=""
                    crossOrigin="anonymous"
                    className="ken-burns-img absolute inset-0 h-full w-full min-h-full min-w-full object-cover"
                    onLoad={() => setHeroLoaded(true)}
                    onError={() => setHeroLoaded(true)}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-b from-[#2a2314] via-[#0d0b06] to-black" />
                )}
              </div>

              <div
                className="absolute inset-0 bg-[rgba(0,0,0,0.4)]"
                aria-hidden
              />

              <div className="relative z-10 flex min-h-[100vh] flex-col justify-center px-4 py-12 sm:px-8 sm:py-16 md:px-10 md:py-20">
                <div
                  className={`mx-auto w-full max-w-xl ${lang === "ko" ? "result-hero-text-ko font-ko" : "result-hero-text-en font-display-en"}`}
                >
                  <div className="stationery-outer p-5 sm:p-7 md:p-9">
                    <p className="font-display-en gold-foil-accent text-[10px] uppercase tracking-[0.35em] sm:text-xs">
                      {t("result.eyebrow")}
                    </p>
                    <h1
                      className={`gold-foil-heading mt-5 text-2xl font-extralight leading-snug sm:text-3xl md:text-4xl ${lang === "en" ? "font-display-en" : "font-ko"}`}
                    >
                      {result.personalityType}
                    </h1>
                    <p
                      className={`mt-4 text-sm font-extralight leading-relaxed text-[#E8DCC8] sm:text-base ${lang === "ko" ? "font-ko" : "font-display-en"}`}
                    >
                      {result.personalitySummary}
                    </p>

                    <div className="stationery-paper mt-8 p-5 sm:p-7 md:p-8">
                      <div className="stationery-paper-inner space-y-4">
                        <p
                          className={`gold-foil-on-paper text-sm font-light sm:text-base ${lang === "ko" ? "font-ko" : "font-display-en"}`}
                        >
                          {t("result.letterHeading")}
                        </p>
                        <p
                          className={`letter-dropcap-wrap letter-body-paper whitespace-pre-line text-[15px] font-extralight leading-[1.9] sm:text-base ${lang === "ko" ? "font-ko" : "font-display-en"}`}
                        >
                          {dropCap ? (
                            <>
                              <span className="drop-cap">{dropCap}</span>
                              {letterRest}
                            </>
                          ) : (
                            result.letter
                          )}
                        </p>
                        <p
                          className={`hardware-teaser-paper border-t border-[rgba(90,82,72,0.2)] pt-5 text-center text-[11px] font-extralight leading-relaxed sm:text-xs ${lang === "ko" ? "font-ko" : "font-display-en"}`}
                        >
                          {t("result.hardwareTeaser")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="font-ko text-center text-xs font-extralight text-[#EDE4D3]">
              {t("result.recordEmail")}: {userEmail}
            </p>

            {result.heroImageSkipped && !result.heroImageUrl ? (
              <p className="font-ko text-center text-xs font-extralight leading-relaxed text-amber-200/90">
                {t("result.heroImageSkipped")}
              </p>
            ) : null}

            {!canCaptureArtwork ? (
              <p className="font-ko text-center text-xs text-[#D4AF37]">
                {t("result.sceneLoading")}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => setBenefitModalOpen(true)}
              className="font-ko block w-full rounded-2xl bg-[#b89a2e] px-6 py-4 text-center text-lg font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928]"
            >
              {t("result.ctaEternalBeam")}
            </button>

            <BenefitBottomSheet
              open={benefitModalOpen}
              onClose={() => setBenefitModalOpen(false)}
              petDisplayName={petName}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={!canCaptureArtwork || isSharing}
                className="font-ko rounded-xl border-[0.5px] border-[rgba(212,175,55,0.45)] bg-transparent px-4 py-3 text-sm font-light text-[#F3EAD8] transition hover:bg-[rgba(212,175,55,0.06)] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {t("result.keepForever")}
              </button>
              <button
                type="button"
                onClick={onInstagramButtonClick}
                disabled={!canCaptureArtwork || isSharing}
                className="font-ko rounded-xl bg-[#b89a2e] px-4 py-3 text-sm font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSharing
                  ? t("result.preparingImage")
                  : shareableFile
                    ? t("result.instagramShare")
                    : t("result.instagramPrepare")}
              </button>
              <button
                type="button"
                onClick={resetTest}
                className="font-ko rounded-xl border-[0.5px] border-[rgba(255,255,255,0.25)] bg-transparent px-4 py-3 text-sm font-light text-[#F3EAD8] transition hover:bg-[rgba(255,255,255,0.04)]"
              >
                {t("result.retryTest")}
              </button>
            </div>
            {shareableFile && !isSharing ? (
              <p className="font-ko text-center text-xs font-extralight leading-6 text-[#EDE4D3]">
                {t("result.instagramHint")}
              </p>
            ) : null}
            {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-screen flex-col bg-black">
        <header className="flex w-full shrink-0 justify-end px-5 pt-6 md:px-8 md:pt-8">
          <LanguageToggle />
        </header>
        <div className="flex flex-1 items-center justify-center px-5 pb-14 pt-2 md:px-8 md:pb-16">
        <section className="w-full max-w-2xl">
          <div className="animate-fade-in mb-10 text-center">
            <p
              className={
                lang === "ko"
                  ? "font-ko text-xs tracking-[0.22em] text-[#D4AF37]"
                  : "font-display-en text-xs uppercase tracking-[0.35em] text-[#D4AF37]"
              }
            >
              {HERO_EYEBROW[lang]}
            </p>
            <h1 className="font-display-en mt-6 text-4xl text-[#FFFFFF] md:text-5xl">
              {t("hero.title")}
            </h1>
            <div
              className={`mx-auto mt-5 max-w-xl space-y-2 text-sm font-extralight leading-8 text-[#F3EAD8] md:text-base ${
                lang === "ko" ? "font-ko" : "font-display-en"
              }`}
            >
              <p className="leading-relaxed">{t("hero.subtitleLine1")}</p>
              <p className="leading-relaxed">{t("hero.subtitleLine2")}</p>
            </div>
          </div>

          <article className="rounded-3xl border-[0.5px] border-[rgba(212,175,55,0.3)] bg-transparent p-6 md:p-10">
            <div className="mb-8 grid gap-3 md:grid-cols-2">
              <input
                type="email"
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                placeholder={t("form.emailPlaceholder")}
                className="font-ko w-full rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-transparent px-4 py-3 text-sm font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 focus:border-[#D4AF37]"
              />
              <input
                type="text"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                placeholder={t("form.petNamePlaceholder")}
                className="font-ko w-full rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-transparent px-4 py-3 text-sm font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 focus:border-[#D4AF37]"
              />
              <input
                type="text"
                value={preferredScenery}
                onChange={(event) => setPreferredScenery(event.target.value)}
                placeholder={t("form.sceneryPlaceholder")}
                className="font-ko w-full rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-transparent px-4 py-3 text-sm font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 focus:border-[#D4AF37] md:col-span-2"
              />
              <label className="font-ko md:col-span-2 flex items-start gap-3 rounded-xl border-[0.5px] border-[rgba(255,255,255,0.18)] bg-transparent p-3">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(event) => setPrivacyConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                />
                <span className="text-xs font-extralight leading-6 text-[#F3EAD8]">
                  {t("form.privacyConsent")}
                </span>
              </label>
            </div>

            <div key={step} className="animate-fade-in">
              <div className="mb-6 flex items-center justify-between text-xs">
                <span className="font-display-en uppercase text-[#D4AF37]">
                  {t("questionHeader.label")} {step + 1}
                </span>
                <span className="font-display-en text-[#D4AF37]">{questions.length}</span>
              </div>
              <div className="mb-7 h-px overflow-hidden rounded-full bg-[rgba(243,234,216,0.12)]">
                <div
                  className="h-full rounded-full bg-[#D4AF37] transition-all duration-700 ease-out"
                  style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                />
              </div>

              <p className="font-ko text-xl font-extralight leading-relaxed text-[#FFFFFF] md:text-2xl">
                {q.emphasisBefore}
                <span className="text-[#D4AF37]">{q.emphasis}</span>
                {q.emphasisAfter}
              </p>

              <textarea
                value={answers[step]}
                onChange={(event) => handleChangeAnswer(event.target.value)}
                placeholder={q.placeholder}
                rows={5}
                className="font-ko mt-6 w-full resize-none rounded-2xl border-[0.5px] border-[rgba(212,175,55,0.28)] bg-transparent p-4 text-sm font-extralight leading-7 text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/45 focus:border-[#D4AF37] md:text-base"
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 0}
                className="font-ko rounded-xl border-[0.5px] border-[rgba(212,175,55,0.45)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("buttons.prev")}
              </button>
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={submitAnswers}
                  disabled={isLoading || !isAnswerValid || !isProfileValid}
                  className="font-ko rounded-xl bg-[#b89a2e] px-4 py-3 text-sm font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? t("buttons.generating") : t("buttons.generate")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!isAnswerValid}
                  className="font-ko rounded-xl border-[0.5px] border-[rgba(212,175,55,0.55)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t("buttons.next")}
                </button>
              )}
            </div>
          </article>
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </section>
        </div>
      </main>
    </>
  );
}
