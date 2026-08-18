"use client";

import { PrivacyConsentBlock } from "@/components/privacy-consent-block";
import { PetIntroForm } from "@/components/pet-intro-form";
import { SurveyFlow } from "@/components/survey-flow";
import { WarmRisingSparkles } from "@/components/warm-rising-sparkles";
import { InstagramStoryCard } from "@/components/instagram-story-card";
import { EternalBeamPreview } from "@/components/eternal-beam-preview";
import { LanguageToggle } from "@/components/language-toggle";
import { ResultAmbientAudio } from "@/components/result-ambient-audio";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { consumeLetterSseStream } from "@/lib/consume-letter-sse";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { pickGenerationLoadingMessage } from "@/lib/generation-loading-messages";
import { primeResultBgm, resolveResultBgmSrc, stopResultBgm } from "@/lib/result-bgm";
import { heroImageSrcForApp } from "@/lib/hero-image-proxy";
import { normalizePersonalityTags } from "@/lib/normalize-personality-tags";
import { pickEmotionalLetterSentence, pickRandomBestLetterSentence } from "@/lib/letter-emotional-line";
import { getEternalBeamInstagramUrl, getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import {
  buildLetterRequestFields,
  EMPTY_PET_INTRO,
  isPetIntroComplete,
  letterPetName,
  petProfilePayloadFromIntro,
  type PetIntroProfile,
} from "@/lib/pet-profile";
import {
  buildSurveyAnswers,
  EMPTY_TONE_PREFS,
  isSurveyComplete,
  isSurveyStepValid,
  MEMORY_STEP_COUNT,
  OPTIONAL_MEMORY_STEP,
  SURVEY_STEP_COUNT,
  type LetterToneOption,
  type LetterTonePrefs,
  type VideoMotion,
} from "@/lib/survey";
import { toJpeg } from "html-to-image";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type GeneratedResult = {
  personalityType: string;
  personalitySummary: string;
  personalityTags: string[];
  letter: string;
  heroImageUrl: string | null;
  /** 배경 이미지 단계 실패 또는 URL 없음 — 편지(GPT)는 성공했을 수 있음 */
  heroImageSkipped?: boolean;
  /** API에 전달된 반려 이름(모달 등에 그대로 표시) */
  savedPetName?: string;
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

/** JPEG가 PNG보다 용량·인코딩 시간에 유리. pixelRatio 2로 디코드 부담 완화 */
const CAPTURE_JPEG_QUALITY = 0.88;
const CAPTURE_PIXEL_RATIO = 2;

function getSnapshotOptions(skipFonts: boolean) {
  return {
    cacheBust: true,
    pixelRatio: CAPTURE_PIXEL_RATIO,
    backgroundColor: "#000000",
    skipFonts,
    useCORS: true,
    quality: CAPTURE_JPEG_QUALITY,
  } as const;
}

const SKIP_FIRST_HERO_IMAGE =
  typeof process.env.NEXT_PUBLIC_SKIP_RESULT_HERO_IMAGE === "string" &&
  process.env.NEXT_PUBLIC_SKIP_RESULT_HERO_IMAGE.trim() === "1";

export default function Home() {
  const { lang, t, messages } = useLocale();

  const [step, setStep] = useState(0);
  const [memoryAnswers, setMemoryAnswers] = useState<string[]>(() =>
    Array(MEMORY_STEP_COUNT).fill(""),
  );
  const [tonePrefs, setTonePrefs] = useState<LetterTonePrefs>(() => ({ ...EMPTY_TONE_PREFS }));
  const [videoMotion, setVideoMotion] = useState<VideoMotion | "">("");
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [petPhotoPreviewUrl, setPetPhotoPreviewUrl] = useState<string | null>(null);
  const [petPhotoSkipped, setPetPhotoSkipped] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [petIntro, setPetIntro] = useState<PetIntroProfile>(() => ({ ...EMPTY_PET_INTRO }));
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [photoPrivacyConsent, setPhotoPrivacyConsent] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  /** 마지막으로 생성된 편지·분석이 맞는 UI 언어 (언어 토글 시 API로 다시 맞춤) */
  const [resultLocale, setResultLocale] = useState<Locale | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareableFile, setShareableFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 이미 편지를 받은 이메일 — 설문 진행·생성 전에 안내 */
  const [profileEmailBlockedMessage, setProfileEmailBlockedMessage] = useState<string | null>(null);
  const [isCheckingProfileEmail, setIsCheckingProfileEmail] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  /** 첫 생성 스트리밍 시에만 감성 로딩 한 줄 (언어 전환 시에는 null) */
  const [generationLoadingMessage, setGenerationLoadingMessage] = useState<string | null>(null);
  /** 스토리 캡처 직전 무작위로 고른 한 줄(매 공유마다 갱신) */
  const [storyShareLine, setStoryShareLine] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const instagramStoryRef = useRef<HTMLDivElement>(null);
  const bgmPrimeRef = useRef<HTMLAudioElement>(null);

  const displayPetName = letterPetName(petIntro);
  const petProfilePayload = petProfilePayloadFromIntro(petIntro);
  const officialSiteUrl = useMemo(() => getEternalBeamMainUrl(), []);
  const instagramProfileUrl = useMemo(() => getEternalBeamInstagramUrl(), []);

  useEffect(() => {
    if (!petPhotoFile) {
      setPetPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(petPhotoFile);
    setPetPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [petPhotoFile]);

  const onPetPhotoChange = useCallback((file: File | null) => {
    setPetPhotoFile(file);
    setPetPhotoSkipped(false);
    if (!file) {
      setVideoMotion("");
      setPhotoPrivacyConsent(false);
    }
  }, []);

  const handleSkipPhoto = useCallback(() => {
    setPetPhotoFile(null);
    setPetPhotoSkipped(true);
    setPhotoPrivacyConsent(false);
    setVideoMotion("");
    setStep((prev) => Math.min(prev + 1, SURVEY_STEP_COUNT - 1));
  }, []);

  const patchPetIntro = useCallback((patch: Partial<PetIntroProfile>) => {
    setPetIntro((prev) => ({ ...prev, ...patch }));
  }, []);

  /** 배경 URL 문자열만 추적한다. `result` 객체를 deps에 넣으면 스트리밍 편지 갱신마다 heroLoaded가 false로 깨져 onLoad가 다시 안 오고 버튼이 막힌다. */
  const heroImageUrl = result?.heroImageUrl ?? null;
  /** 동일 출처 프록시 — 외부 Blob URL은 CORS로 캔버스 캡처가 막히므로 html-to-image용 */
  const { heroDisplaySrc, heroUsesProxy } = useMemo(() => {
    if (!heroImageUrl) return { heroDisplaySrc: null as string | null, heroUsesProxy: false };
    const proxied = heroImageSrcForApp(heroImageUrl);
    return {
      heroDisplaySrc: proxied ?? heroImageUrl,
      heroUsesProxy: Boolean(proxied),
    };
  }, [heroImageUrl]);

  useEffect(() => {
    if (!heroImageUrl) {
      setHeroLoaded(true);
      return;
    }
    setHeroLoaded(false);
  }, [heroImageUrl]);

  /** SSE로 `result` 참조가 매 델타마다 바뀌면 deps에 `result`가 있을 때 effect가 반복 실행 → fetch abort → 로딩 멈춤 등 버그 유발 */
  const resultHeroUrlForLocaleSwitch = result?.heroImageUrl ?? null;
  const hasResult = result != null;

  useEffect(() => {
    if (!hasResult || resultLocale === null) return;
    if (lang === resultLocale) return;

    let cancelled = false;
    const ac = new AbortController();

    void (async () => {
      setGenerationLoadingMessage(null);
      setIsLoading(true);
      setError(null);
      const heroUrl = resultHeroUrlForLocaleSwitch;
      try {
        const surveyPayload = buildSurveyAnswers(messages, memoryAnswers, tonePrefs, displayPetName);

        const response = await fetch("/api/generate-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            locale: lang,
            userEmail: userEmail.trim(),
            ...buildLetterRequestFields(petIntro, memoryAnswers, tonePrefs)!,
            privacyConsent,
            answers: surveyPayload,
            skipImageGeneration: true,
            existingHeroImageUrl: heroUrl,
          }),
        });

        if (cancelled) return;

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(errorData?.error ?? t("errors.generateFailed"));
        }

        const data = (await response.json()) as GeneratedResult;
        if (cancelled) return;

        setResult({
          ...data,
          personalityTags: normalizePersonalityTags(data.personalityTags, lang),
          heroImageUrl: data.heroImageUrl ?? null,
          heroImageSkipped: data.heroImageSkipped === true,
          savedPetName:
            typeof data.savedPetName === "string" ? data.savedPetName : displayPetName,
        });
        setResultLocale(lang);
        setShareableFile(null);
        setStoryShareLine(null);
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (cancelled || aborted) return;
        setError(userFacingErrorMessage(err, t("errors.generateFailed")));
        setResultLocale(lang);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [
    lang,
    resultLocale,
    hasResult,
    resultHeroUrlForLocaleSwitch,
    memoryAnswers,
    tonePrefs,
    messages,
    displayPetName,
    userEmail,
    petIntro,
    privacyConsent,
    t,
  ]);

  const isLastQuestion = step === SURVEY_STEP_COUNT - 1;
  const isAnswerValid = isSurveyStepValid(step, memoryAnswers, tonePrefs, {
    hasPhoto: petPhotoFile != null,
    skipped: petPhotoSkipped,
    photoConsent: photoPrivacyConsent,
  });
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
  const isProfileValid = isEmailValid && isPetIntroComplete(petIntro) && privacyConsent;

  const checkEmailEligibility = useCallback(async (): Promise<"eligible" | "used" | "error"> => {
    const email = userEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "eligible";
    }
    try {
      const response = await fetch("/api/check-letter-eligibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        eligible?: boolean;
        checkSkipped?: boolean;
      };
      if (!response.ok) {
        // DB·네트워크 오류 시 설문 진행은 허용 (generate-letter에서 재검증)
        return "eligible";
      }
      if (data.checkSkipped === true) return "eligible";
      return data.eligible === true ? "eligible" : "used";
    } catch {
      return "eligible";
    }
  }, [userEmail]);

  const handleEmailBlur = useCallback(() => {
    const trimmed = userEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setProfileEmailBlockedMessage(null);
      return;
    }
    void (async () => {
      setIsCheckingProfileEmail(true);
      const result = await checkEmailEligibility();
      setIsCheckingProfileEmail(false);
      if (result === "used") {
        setProfileEmailBlockedMessage(t("errors.emailAlreadyUsedSoft"));
      } else {
        setProfileEmailBlockedMessage(null);
      }
    })();
  }, [userEmail, checkEmailEligibility, t]);

  const handleMemoryChange = (index: number, value: string) => {
    setMemoryAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSkipOptional = () => {
    handleMemoryChange(OPTIONAL_MEMORY_STEP, "");
    setStep((prev) => Math.min(prev + 1, SURVEY_STEP_COUNT - 1));
  };

  const handleToneOptionToggle = (option: LetterToneOption) => {
    setTonePrefs((prev) => ({
      ...prev,
      options: prev.options.includes(option)
        ? prev.options.filter((o) => o !== option)
        : [...prev.options, option],
    }));
  };

  const goNext = async () => {
    if (!isAnswerValid) return;
    if (step === 0 && isEmailValid) {
      setIsCheckingProfileEmail(true);
      setProfileEmailBlockedMessage(null);
      setError(null);
      const result = await checkEmailEligibility();
      setIsCheckingProfileEmail(false);
      if (result === "used") {
        setProfileEmailBlockedMessage(t("errors.emailAlreadyUsedSoft"));
        return;
      }
    }
    setStep((prev) => Math.min(prev + 1, SURVEY_STEP_COUNT - 1));
  };

  const goPrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const submitAnswers = async () => {
    if (!isSurveyComplete(memoryAnswers, tonePrefs)) {
      setError(t("errors.fillAll"));
      return;
    }
    if (!isProfileValid) {
      setError(t("errors.profileIncomplete"));
      return;
    }

    setError(null);
    if (isEmailValid) {
      const elig = await checkEmailEligibility();
      if (elig === "used") {
        setProfileEmailBlockedMessage(t("errors.emailAlreadyUsedSoft"));
        return;
      }
    }

    await primeResultBgm(bgmPrimeRef);

    setError(null);
    setShareableFile(null);
    setStoryShareLine(null);
    setGenerationLoadingMessage(pickGenerationLoadingMessage(lang, displayPetName));
    setResult({
      personalityType: "",
      personalitySummary: "",
      personalityTags: [],
      letter: "",
      heroImageUrl: null,
      heroImageSkipped: false,
      savedPetName: displayPetName,
    });
    setResultLocale(lang);
    setIsLoading(true);

    try {
      const surveyPayload = buildSurveyAnswers(messages, memoryAnswers, tonePrefs, displayPetName);

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: lang,
          userEmail: userEmail.trim(),
          ...buildLetterRequestFields(petIntro, memoryAnswers, tonePrefs)!,
          privacyConsent,
          answers: surveyPayload,
          stream: true,
          ...(SKIP_FIRST_HERO_IMAGE
            ? { skipImageGeneration: true, existingHeroImageUrl: null as string | null }
            : {}),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? t("errors.generateFailed"));
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        await consumeLetterSseStream(response, {
          onLetterDelta: (delta) => {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    letter: `${prev.letter}${delta}`,
                  }
                : prev,
            );
          },
          onHero: (heroImageUrl, heroImageSkipped) => {
            setResult((prev) =>
              prev
                ? {
                    ...prev,
                    heroImageUrl,
                    heroImageSkipped,
                  }
                : prev,
            );
          },
          onDone: (data) => {
            setResult({
              personalityType: data.personalityType,
              personalitySummary: data.personalitySummary,
              personalityTags: normalizePersonalityTags(data.personalityTags, lang),
              letter: data.letter,
              heroImageUrl: data.heroImageUrl ?? null,
              heroImageSkipped: data.heroImageSkipped === true,
              savedPetName:
                typeof data.savedPetName === "string" && data.savedPetName.trim().length > 0
                  ? data.savedPetName.trim()
                  : displayPetName,
            });
            setResultLocale(lang);
          },
        });
      } else {
        const data = (await response.json()) as GeneratedResult;
        setResult({
          ...data,
          personalityTags: normalizePersonalityTags(data.personalityTags, lang),
          heroImageUrl: data.heroImageUrl ?? null,
          heroImageSkipped: data.heroImageSkipped === true,
          savedPetName: typeof data.savedPetName === "string" ? data.savedPetName : displayPetName,
        });
        setResultLocale(lang);
      }
    } catch (err) {
      stopResultBgm(bgmPrimeRef);
      setResult(null);
      setResultLocale(null);
      setError(userFacingErrorMessage(err, t("errors.generateFailed")));
    } finally {
      setIsLoading(false);
      setGenerationLoadingMessage(null);
    }
  };

  const captureToJpegDataUrl = async (skipFonts: boolean) => {
    if (!captureRef.current) return "";
    return toJpeg(captureRef.current, getSnapshotOptions(skipFonts));
  };

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    try {
      setError(null);
      let dataUrl: string;
      try {
        dataUrl = await captureToJpegDataUrl(false);
      } catch {
        dataUrl = await captureToJpegDataUrl(true);
      }
      const anchor = document.createElement("a");
      anchor.download = "soul-trace-letter.jpg";
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

  const captureImage = async (): Promise<File | null> => {
    const source = instagramStoryRef.current;
    if (!source || !result) return null;

    setIsSharing(true);
    setError(null);

    try {
      const picked =
        pickRandomBestLetterSentence(result.letter, lang) ||
        pickEmotionalLetterSentence(result.letter, lang) ||
        result.letter.trim().slice(0, 140);
      flushSync(() => {
        setStoryShareLine(picked);
      });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = await toJpeg(source, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0f1012",
        quality: CAPTURE_JPEG_QUALITY,
        skipFonts: true,
        fontEmbedCSS: "",
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "soultrace-story.jpg", { type: "image/jpeg" });
      setShareableFile(file);
      return file;
    } catch (err) {
      setShareableFile(null);
      setError(err instanceof Error ? err.message : t("errors.prepareShareFailed"));
      return null;
    } finally {
      setIsSharing(false);
    }
  };

  const prepareInstagramShare = async (): Promise<File | null> => {
    const file = await captureImage();
    if (!file) return null;
    return file;
  };

  const openInstagramShare = async (file?: File | null) => {
    const activeFile = file ?? shareableFile;
    if (!activeFile) return;
    setError(null);

    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isLikelyMobile =
      /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    const downloadThenOpenInstagramTab = () => {
      const url = URL.createObjectURL(activeFile);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = activeFile.name || "soultrace-story.jpg";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      window.open(instagramProfileUrl, "_blank", "noopener,noreferrer");
    };

    try {
      if (
        isLikelyMobile &&
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        "canShare" in navigator
      ) {
        const sharePayload: ShareData = {
          files: [activeFile],
          title: t("share.title"),
          text: t("share.text"),
        };
        if (navigator.canShare?.(sharePayload)) {
          await navigator.share(sharePayload);
          return;
        }
      }
      downloadThenOpenInstagramTab();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        downloadThenOpenInstagramTab();
      } catch (fallbackErr) {
        setError(fallbackErr instanceof Error ? fallbackErr.message : t("errors.shareFailed"));
      }
    }
  };

  const onInstagramButtonClick = () => {
    void (async () => {
      const file = await prepareInstagramShare();
      if (file) {
        await openInstagramShare(file);
      }
    })();
  };

  const resetTest = () => {
    setStep(0);
    setMemoryAnswers(Array(MEMORY_STEP_COUNT).fill(""));
    setTonePrefs({ ...EMPTY_TONE_PREFS });
    setVideoMotion("");
    setPetPhotoFile(null);
    setPetPhotoSkipped(false);
    setUserEmail("");
    setPetIntro({ ...EMPTY_PET_INTRO });
    setPrivacyConsent(false);
    setPhotoPrivacyConsent(false);
    setProfileEmailBlockedMessage(null);
    setResult(null);
    setResultLocale(null);
    setShareableFile(null);
    setError(null);
    setGenerationLoadingMessage(null);
    setHeroLoaded(false);
    setStoryShareLine(null);
    stopResultBgm(bgmPrimeRef);
  };

  const defaultStoryShareLine = useMemo(
    () => (result ? pickEmotionalLetterSentence(result.letter, lang) : ""),
    [result, lang],
  );
  const storyCardQuote = (storyShareLine ?? defaultStoryShareLine).trim();

  const storyPetNameLead = useMemo(() => {
    const template = t("result.instagramStory.petStoryNameLead");
    const name =
      (result?.savedPetName ?? displayPetName).trim() || t("result.benefitModal.nameFallback");
    return template.replace(/%NAME%/g, name);
  }, [result?.savedPetName, displayPetName, t]);

  const canCaptureArtwork = !result?.heroImageUrl || heroLoaded;
  const letterSplit = result ? splitLetterForDropCap(result.letter) : null;
  const dropCap = letterSplit?.first ?? "";
  const letterRest = letterSplit?.rest ?? "";

  return (
    <>
      <audio
        ref={bgmPrimeRef}
        src={resolveResultBgmSrc()}
        loop
        preload="auto"
        className="hidden"
        aria-hidden
      />
      {result ? (
        <main className="min-h-screen bg-black pb-10">
          <header className="flex w-full justify-end px-4 pt-6 sm:px-6">
            <LanguageToggle />
          </header>
          <section className="mx-auto w-full max-w-3xl space-y-8 px-4 sm:px-6">
            {isLoading ? (
              <p
                className={`text-center text-sm font-extralight text-[#D4AF37] ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {generationLoadingMessage ?? t("result.updatingLanguage")}
              </p>
            ) : null}
            <div
              ref={captureRef}
              id="share-card"
              className={`relative min-h-[100vh] w-full overflow-hidden rounded-sm shadow-[0_0_80px_rgba(212,175,55,0.12)] ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="result-hero-placeholder absolute inset-0" aria-hidden />
                {heroDisplaySrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- dynamic hero URL + crossOrigin for html capture
                  <img
                    src={heroDisplaySrc}
                    alt=""
                    {...(heroUsesProxy ? {} : { crossOrigin: "anonymous" as const })}
                    className={`ken-burns-img absolute inset-0 h-full w-full min-h-full min-w-full object-cover transition-opacity duration-700 ease-out ${
                      heroLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    onLoad={() => setHeroLoaded(true)}
                    onError={() => setHeroLoaded(true)}
                  />
                ) : null}
              </div>

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/[0.42] via-black/[0.14] to-black/[0.48]"
                aria-hidden
              />

              <div className="relative z-10 flex min-h-[100vh] flex-col justify-center px-6 py-14 sm:px-10 sm:py-20 md:px-14">
                <div className="relative mx-auto w-full max-w-3xl">
                  {/* 텍스트 영역 전용: 일러스트는 비추면서 글자 대비만 올리는 잡지형 스크림 */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-5 -inset-y-8 rounded-[1.25rem] bg-gradient-to-b from-[rgba(10,11,14,0.78)] via-[rgba(8,9,11,0.58)] to-[rgba(7,8,10,0.72)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.06] sm:-inset-x-8 sm:-inset-y-10 md:-inset-x-10 md:-inset-y-12"
                  />
                  <div
                    className={`relative z-[1] space-y-11 ${
                      lang === "ko" ? "result-hero-text-ko font-ko" : "result-hero-text-en font-display-en"
                    }`}
                  >
                    <div className="space-y-5 text-center">
                    <p className="font-display-en text-[10px] uppercase tracking-[0.42em] text-[#D4AF37]/72 sm:text-xs">
                      {t("result.eyebrow")}
                    </p>
                    <h1
                      className={`text-3xl font-extralight leading-snug text-[#EAD8B7] sm:text-4xl md:text-5xl ${
                        isLoading && !result.personalityType.trim() ? "animate-pulse opacity-[0.78]" : ""
                      }`}
                    >
                      {isLoading && !result.personalityType.trim()
                        ? t("result.streamingPersonalityTitle")
                        : result.personalityType}
                    </h1>
                    <p
                      className={`mx-auto max-w-2xl text-[15px] font-extralight leading-[1.9] text-[#F2EFE6] sm:text-base ${
                        isLoading && !result.personalitySummary.trim()
                          ? "animate-pulse opacity-[0.78]"
                          : ""
                      }`}
                    >
                      {isLoading && !result.personalitySummary.trim()
                        ? t("result.streamingPersonalityBody")
                        : result.personalitySummary}
                    </p>
                    {(result.personalityTags ?? []).length > 0 ? (
                      <p className="text-xs font-extralight tracking-[0.16em] text-[#CDB894]/72 sm:text-sm">
                        {(result.personalityTags ?? [])
                          .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
                          .join("   ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="mx-auto h-px w-full max-w-xl bg-gradient-to-r from-transparent via-[#D4AF37]/32 to-transparent" />

                  <div className="space-y-6 text-center">
                    <p className="text-sm font-light tracking-[0.08em] text-[#D9C6A4] sm:text-base">
                      {t("result.letterHeading")}
                    </p>
                    {isLoading && !result.letter.trim() ? (
                      <p
                        className={`mx-auto max-w-2xl text-[17px] font-extralight leading-[2] text-[#ECE7DC]/84 sm:text-lg ${
                          lang === "ko" ? "break-keep" : ""
                        } animate-pulse`}
                      >
                        {t("result.letterStarting")}
                      </p>
                    ) : null}
                    <p
                      className={`mx-auto max-w-2xl whitespace-pre-line text-left text-[17px] font-extralight leading-[2] text-[#F7F4EF] sm:text-lg ${
                        lang === "ko" ? "break-keep" : ""
                      }`}
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
                  </div>
                </div>
              </div>
            </div>
          </div>

            <div
              className={`mx-auto mt-10 max-w-xl space-y-10 px-1 text-center sm:mt-12 ${
                lang === "ko" ? "font-ko" : "font-display-en"
              }`}
            >
              <div className="space-y-6 text-[15px] font-extralight leading-[1.95] tracking-[0.02em] text-[#EDE4D3]/95 sm:text-base sm:leading-[2]">
                <p className="whitespace-pre-line">{t("result.emotionalBridge.block1")}</p>
                <p className="whitespace-pre-line text-[#F3EAD8]">{t("result.emotionalBridge.block2")}</p>
              </div>
            </div>

            <EternalBeamPreview lang={lang} />

            <p
              className={`mt-6 text-center text-[11px] font-extralight leading-relaxed text-[#C4B8A8]/85 ${
                lang === "ko" ? "font-ko" : "font-display-en"
              }`}
            >
              {(result.savedPetName ?? displayPetName).trim()}
              {petProfilePayload
                ? ` · ${petProfilePayload.yearMet}–${petProfilePayload.yearParted}`
                : null}
            </p>

            {!canCaptureArtwork ? (
              <p className="font-ko mt-4 text-center text-xs text-[#D4AF37]">
                {t("result.sceneLoading")}
              </p>
            ) : null}

            <div className="mx-auto mt-8 w-full max-w-xl text-center">
              <p
                className={`mb-3 text-sm font-extralight leading-relaxed text-[#D4AF37]/88 sm:text-[13px] ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {t("result.instagramShareLead")}
              </p>
              <button
                type="button"
                onClick={onInstagramButtonClick}
                disabled={!canCaptureArtwork || isSharing}
                className={`w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(26,26,26,0.78)] px-5 py-4 text-sm font-light text-[#F3EAD8] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[rgba(212,175,55,0.28)] hover:bg-[rgba(30,28,26,0.88)] disabled:cursor-not-allowed disabled:opacity-45 sm:text-base ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {isSharing
                  ? t("result.preparingImage")
                  : shareableFile
                    ? t("result.instagramCardReady")
                    : t("result.instagramShareButton")}
              </button>
            </div>

            <div className="mx-auto mt-12 w-full max-w-xl space-y-5">
              <article
                className={`rounded-2xl border border-[rgba(212,175,55,0.22)] bg-[rgba(18,16,14,0.72)] px-5 py-7 text-left shadow-[0_0_40px_rgba(212,175,55,0.06)] sm:px-8 sm:py-8 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37]/95 sm:text-xs">
                  {t("result.destinationDeck.officialSite.label")}
                </p>
                <h3 className="mt-3 text-[15px] font-extralight leading-snug text-[#EDE4D3] sm:text-base">
                  {t("result.destinationDeck.officialSite.title")}
                </h3>
                <p className="mt-3 text-sm font-extralight leading-relaxed text-[#C4B8A8] sm:text-[15px]">
                  {t("result.destinationDeck.officialSite.body")}
                </p>
                <a
                  href={officialSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 flex w-full items-center justify-center rounded-2xl bg-[#b89a2e] px-5 py-3.5 text-center text-base font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  {t("result.destinationDeck.officialSite.cta")}
                </a>
              </article>

              <article
                className={`rounded-2xl border border-[rgba(212,175,55,0.15)] bg-[rgba(18,16,14,0.65)] px-5 py-7 text-left sm:px-8 sm:py-8 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37]/95 sm:text-xs">
                  {t("result.destinationDeck.instagram.label")}
                </p>
                <h3 className="mt-3 text-[15px] font-extralight leading-snug text-[#EDE4D3] sm:text-base">
                  {t("result.destinationDeck.instagram.title")}
                </h3>
                <p className="mt-3 text-sm font-extralight leading-relaxed text-[#C4B8A8] sm:text-[15px]">
                  {t("result.destinationDeck.instagram.body")}
                </p>
                <a
                  href={instagramProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 flex w-full items-center justify-center rounded-xl border border-[rgba(212,175,55,0.4)] bg-[#1A1A1A]/90 px-5 py-3.5 text-sm font-light text-[#F5E6B8] transition hover:border-[rgba(212,175,55,0.55)] hover:bg-[#222018] sm:text-base ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  {t("result.destinationDeck.instagram.cta")}
                </a>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-extralight text-[#4a4744]/95 sm:text-[11px]">
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={!canCaptureArtwork || isSharing}
                className={`transition hover:text-[#6b6865] disabled:cursor-not-allowed disabled:opacity-40 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {t("result.keepForever")}
              </button>
              <span className="select-none text-[#3a3634]" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={resetTest}
                className={`transition hover:text-[#6b6865] ${lang === "ko" ? "font-ko" : "font-display-en"}`}
              >
                {t("result.retryTest")}
              </button>
            </div>
            {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
          </section>
          <div
            className="pointer-events-none fixed top-0 -left-[9999px] z-[-1] opacity-0"
            style={{ width: 1080, height: 1920 }}
            aria-hidden
          >
            <InstagramStoryCard
              ref={instagramStoryRef}
              heroSrc={heroDisplaySrc}
              nameLead={storyPetNameLead}
              personalityTitle={result.personalityType}
              emotionalLine={storyCardQuote || result.letter.trim()}
              footerTagline={t("result.instagramStory.footerTagline")}
              siteLine={t("result.instagramStory.siteLine")}
              lang={lang}
            />
          </div>
          <ResultAmbientAudio active={!!result} audioRef={bgmPrimeRef} />
        </main>
      ) : (
      <main className="relative isolate flex min-h-screen flex-col bg-black">
        <WarmRisingSparkles />
        <header className="relative z-[2] flex w-full shrink-0 justify-end px-5 pt-6 md:px-8 md:pt-8">
          <LanguageToggle />
        </header>
        <div className="relative z-[2] flex flex-1 items-center justify-center px-5 pb-14 pt-2 md:px-8 md:pb-16">
        <section className="w-full max-w-2xl">
          <div className="animate-fade-in mb-10 text-center">
            <p className="font-display-en text-xs uppercase tracking-[0.35em] text-[#D4AF37]">
              {t("hero.eyebrow")}
            </p>
            <h1 className="font-display-en mt-6 text-4xl text-[#FFFFFF] md:text-5xl">
              {t("hero.title")}
            </h1>
            <div
              className={`mx-auto mt-7 max-w-xl space-y-6 text-[#F3EAD8]/[0.94] ${
                lang === "ko"
                  ? "font-ko break-keep text-[15px] font-extralight leading-[2.05] tracking-[0.055em] sm:text-base sm:leading-[2.1] sm:tracking-[0.05em]"
                  : "font-display-en text-sm font-extralight leading-[2.05] tracking-[0.2em] sm:text-base sm:leading-[2.15] sm:tracking-[0.18em]"
              }`}
            >
              <p className="whitespace-pre-line">{t("hero.subtitleLine1")}</p>
              <p>{t("hero.subtitleLine2")}</p>
            </div>
          </div>

          <article className="rounded-3xl border-[0.5px] border-[rgba(212,175,55,0.3)] bg-transparent p-6 md:p-10">
            <div className="mb-8 space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="user-email"
                  className={`text-sm font-extralight text-[#F3EAD8] sm:text-[15px] ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  {t("form.emailLabel")}
                </label>
                <input
                  id="user-email"
                  type="email"
                value={userEmail}
                onChange={(event) => {
                  setProfileEmailBlockedMessage(null);
                  setUserEmail(event.target.value);
                }}
                onBlur={handleEmailBlur}
                placeholder={t("form.emailPlaceholder")}
                className={`font-ko w-full rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-transparent px-4 py-3 text-base font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 focus:border-[#D4AF37] md:text-sm`}
              />
              </div>
              <PetIntroForm profile={petIntro} onChange={patchPetIntro} />
              <PrivacyConsentBlock
                titlePath="form.privacyConsentTitle"
                bodyPath="form.privacyConsentBody"
                agreePath="form.privacyConsentAgree"
                checked={privacyConsent}
                onChange={setPrivacyConsent}
              />
            </div>

            {profileEmailBlockedMessage ? (
              <p
                className={`mb-6 rounded-xl border-[0.5px] border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.06)] px-4 py-3 text-xs font-extralight leading-relaxed text-[#F3EAD8]/95 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
                role="alert"
              >
                {profileEmailBlockedMessage}
              </p>
            ) : null}

            <div key={step} className="animate-fade-in">
              <SurveyFlow
                step={step}
                petDisplayName={displayPetName}
                memoryAnswers={memoryAnswers}
                tonePrefs={tonePrefs}
                petPhotoPreviewUrl={petPhotoPreviewUrl}
                onPetPhotoChange={onPetPhotoChange}
                onSkipPhoto={handleSkipPhoto}
                photoPrivacyConsent={photoPrivacyConsent}
                onPhotoPrivacyConsentChange={setPhotoPrivacyConsent}
                videoMotion={videoMotion}
                onVideoMotionChange={setVideoMotion}
                onMemoryChange={handleMemoryChange}
                onToneMood={(mood) => setTonePrefs((prev) => ({ ...prev, mood }))}
                onToneOptionToggle={handleToneOptionToggle}
                onToneLength={(length) => setTonePrefs((prev) => ({ ...prev, length }))}
                onSkipOptional={handleSkipOptional}
              />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={step === 0}
                className="font-ko min-h-[44px] rounded-xl border-[0.5px] border-[rgba(212,175,55,0.45)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] active:bg-[rgba(212,175,55,0.1)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("buttons.prev")}
              </button>
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={submitAnswers}
                  disabled={
                    isLoading ||
                    !isSurveyComplete(memoryAnswers, tonePrefs) ||
                    !isProfileValid ||
                    Boolean(profileEmailBlockedMessage)
                  }
                  className="font-ko min-h-[44px] rounded-xl bg-[#b89a2e] px-4 py-3 text-sm font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? t("buttons.generating") : t("buttons.generate")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={
                    !isAnswerValid ||
                    (step === 0 &&
                      isEmailValid &&
                      (!!profileEmailBlockedMessage || isCheckingProfileEmail))
                  }
                  className="font-ko min-h-[44px] rounded-xl border-[0.5px] border-[rgba(212,175,55,0.55)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] active:bg-[rgba(212,175,55,0.1)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t("buttons.next")}
                </button>
              )}
            </div>
            {isLastQuestion && !isLoading && (!isSurveyComplete(memoryAnswers, tonePrefs) || !isProfileValid) ? (
              <p
                className={`mt-3 text-center text-xs font-extralight leading-relaxed text-[#D4AF37]/90 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {!isSurveyComplete(memoryAnswers, tonePrefs)
                  ? t("form.generateNeedAnswer")
                  : t("form.generateNeedProfile")}
              </p>
            ) : null}
            {isLoading ? (
              <p
                className={`mt-4 text-center text-xs font-extralight leading-relaxed text-[#D4AF37]/85 ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {t("buttons.generatingMusicHint")}
              </p>
            ) : null}
          </article>
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </section>
        </div>
      </main>
      )}
    </>
  );
}
