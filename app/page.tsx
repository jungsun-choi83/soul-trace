"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { consumeLetterSseStream } from "@/lib/consume-letter-sse";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { pickGenerationLoadingMessage } from "@/lib/generation-loading-messages";
import { primeResultBgm, resolveResultBgmSrc, stopResultBgm } from "@/lib/result-bgm";
import { heroImageSrcForApp } from "@/lib/hero-image-proxy";
import { normalizePersonalityTags } from "@/lib/normalize-personality-tags";
import { pickEmotionalLetterSentence, pickRandomBestLetterSentence } from "@/lib/letter-emotional-line";
import {
  buildHandoffUrl,
  getEternalBeamInstagramUrl,
  getEternalBeamMainUrl,
} from "@/lib/eternalbeam-urls";
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
  /**
   * 저장된 편지의 letter_id — Eternal Beam 핸드오프의 traceId.
   * 저장 실패·마이그레이션 전이면 null 이라 핸드오프 CTA 가 나오지 않는다.
   */
  letterId?: string | null;
  /**
   * 서버가 편지를 **저장하지 못했다.** 화면에는 편지가 보이지만 DB 에는 없다.
   * 조용히 넘기면 사용자는 저장됐다고 믿고 창을 닫고, 편지는 영영 사라진다.
   */
  persistenceFailed?: boolean;
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
  const [mainPrivacySheetOpen, setMainPrivacySheetOpen] = useState(false);
  const [photoPrivacySheetOpen, setPhotoPrivacySheetOpen] = useState(false);
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
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const instagramStoryRef = useRef<HTMLDivElement>(null);
  const bgmPrimeRef = useRef<HTMLAudioElement>(null);

  const displayPetName = letterPetName(petIntro);
  const petProfilePayload = petProfilePayloadFromIntro(petIntro);
  const officialSiteUrl = useMemo(() => getEternalBeamMainUrl(), []);

  /**
   * 편지를 Eternal Beam 으로 넘긴다.
   *
   * 브라우저는 **편지를 들고 가지 않는다.** 서버에서 일회용 능력(핸드오프 토큰)을
   * 받아 traceId 와 함께 URL 에만 싣고, 본문은 Eternal Beam 이 서버 대 서버로
   * 따로 가져간다. 그래서 이 링크가 새어도 15분 뒤에는, 또는 한 번 쓰이고 나면
   * 아무것도 열지 못한다.
   */
  const continueToEternalBeam = useCallback(async () => {
    const letterId = result?.letterId;
    if (!letterId || handoffBusy) return;

    setHandoffBusy(true);
    setHandoffError(null);
    try {
      const response = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId }),
      });
      if (!response.ok) throw new Error("handoff request failed");

      const data = (await response.json()) as { traceId?: string; handoff?: string };
      if (!data.traceId || !data.handoff) throw new Error("handoff response incomplete");

      // 같은 탭으로 이동한다 — 토큰이 남겨진 탭에 방치되지 않는다.
      // 성공 시 busy 를 되돌리지 않는다: 이 줄 다음은 실행되지 않는다.
      window.location.assign(buildHandoffUrl(data.traceId, data.handoff));
    } catch {
      setHandoffError(t("result.destinationDeck.continueToEternalBeam.error"));
      setHandoffBusy(false);
    }
  }, [result?.letterId, handoffBusy, t]);
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
      return;
    }
    if (!photoPrivacyConsent) {
      setPhotoPrivacySheetOpen(true);
    }
  }, [photoPrivacyConsent]);

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
    if (!privacyConsent) {
      setMainPrivacySheetOpen(true);
      return;
    }
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
              letterId: data.letterId ?? null,
              persistenceFailed: data.persistenceFailed === true,
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
    setMainPrivacySheetOpen(false);
    setPhotoPrivacySheetOpen(false);
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
    <main className="relative isolate flex min-h-screen flex-col bg-black">
      <WarmRisingSparkles />
      <header className="relative z-[2] flex w-full shrink-0 justify-end px-5 pt-6 md:px-8 md:pt-8">
        <LanguageToggle />
      </header>

      <div className="relative z-[2] flex flex-1 items-center justify-center px-5 pb-16 pt-2 md:px-8">
        <section className="animate-fade-in w-full max-w-xl text-center">
          <p className="font-display-en text-xs uppercase tracking-[0.35em] text-[#D4AF37]">
            {t("hero.eyebrow")}
          </p>
          <h1 className="font-display-en mt-6 text-4xl text-[#FFFFFF] md:text-5xl">
            {t("hero.title")}
          </h1>
          <p
            className={`mx-auto mt-7 max-w-lg whitespace-pre-line text-[#F3EAD8]/[0.94] ${
              lang === "ko"
                ? "font-ko break-keep text-[15px] font-extralight leading-[2.05] tracking-[0.055em] sm:text-base"
                : "font-display-en text-sm font-extralight leading-[2.05] tracking-[0.2em] sm:text-base"
            }`}
          >
            {t("hero.subtitleLine1")}
          </p>

            <div className="mx-auto mt-12 w-full max-w-xl space-y-5">
              {/*
                저장 실패를 **말한다.** 이 경고가 없으면 사용자는 완벽한 편지를
                보고 저장됐다고 믿은 채 창을 닫고, 편지는 영영 사라진다.
                (서버는 이미 자세한 원인을 로그에 남겼다.)
              */}
              {result.persistenceFailed ? (
                <article
                  role="alert"
                  className={`rounded-2xl border border-red-400/50 bg-red-950/40 px-5 py-6 text-left sm:px-8 ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  <h3 className="text-[15px] font-medium leading-snug text-red-200 sm:text-base">
                    {t("result.persistenceFailed.title")}
                  </h3>
                  <p className="mt-2 text-sm font-extralight leading-relaxed text-red-100/80 sm:text-[15px]">
                    {t("result.persistenceFailed.body")}
                  </p>
                </article>
              ) : null}

              {/*
                편지 핸드오프. letterId 가 있을 때만 보인다 — 저장이 실패했거나
                마이그레이션 전이면 넘길 편지가 서버에 없으므로, 실패할 버튼을
                보여 주지 않는다.
              */}
              {result.letterId ? (
                <article
                  className={`rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(24,20,14,0.82)] px-5 py-7 text-left shadow-[0_0_48px_rgba(212,175,55,0.10)] sm:px-8 sm:py-8 ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  <span className="block text-base font-light leading-snug sm:text-lg">
                    {copy.landingCta}
                  </span>
                  <span
                    className={`mt-1.5 block text-xs font-extralight leading-relaxed sm:text-[13px] ${
                      primary ? "text-black/62" : "text-[#C4B8A8]"
                    }`}
                  >
                    {copy.landingHint}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
