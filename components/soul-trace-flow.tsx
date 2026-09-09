"use client";

import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import { PrivacyConsentSheet } from "@/components/privacy-consent-sheet";
import { PetIntroForm } from "@/components/pet-intro-form";
import { SurveyFlow } from "@/components/survey-flow";
import { WarmRisingSparkles } from "@/components/warm-rising-sparkles";
import { InstagramStoryCard } from "@/components/instagram-story-card";
import { EternalBeamPreview } from "@/components/eternal-beam-preview";
import { LanguageToggle } from "@/components/language-toggle";
import { ResultAmbientAudio } from "@/components/result-ambient-audio";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { letterModePath, modeCopy, type LetterMode } from "@/lib/letter-mode";
import Link from "next/link";
import { consumeLetterSseStream } from "@/lib/consume-letter-sse";
import { readPartnerCode } from "@/lib/partner";
import {
  isServiceChannelCompatible,
  serviceChannelMode,
  type ServiceChannel,
} from "@/lib/service-channel";
import { serviceChannelBackground } from "@/lib/service-channel-background";
import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { pickGenerationLoadingMessage } from "@/lib/generation-loading-messages";
import { primeResultBgm, resolveResultBgmSrc, stopResultBgm } from "@/lib/result-bgm";
import { normalizePersonalityTags } from "@/lib/normalize-personality-tags";
import {
  loadTemporaryLifeArchive,
  saveTemporaryLifeArchive,
} from "@/lib/life-archive-temporary";
import { pickEmotionalLetterSentence, pickRandomBestLetterSentence } from "@/lib/letter-emotional-line";
import {
  createGeneratedLetterStructure,
  visibleStreamingBody,
  type GeneratedLetterStructure,
} from "@/lib/generated-letter";
import {
  DEFAULT_LETTER_THEME_ID,
  getLetterTheme,
  isLetterThemeId,
  LETTER_THEMES,
  type LetterThemeId,
} from "@/lib/letter-themes";
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
  resolveRecipientAddress,
  type PetIntroProfile,
} from "@/lib/pet-profile";
import {
  buildSurveyAnswers,
  EMPTY_TONE_PREFS,
  isSurveyComplete,
  isSurveyStepValid,
  memoryQuestionCount,
  MEMORY_STEP_COUNT,
  PHOTO_STEP_COUNT,
  surveyIntroduction,
  TONE_STEP_COUNT,
  type LetterToneOption,
  type LetterTonePrefs,
  type VideoMotion,
} from "@/lib/survey";
import { toJpeg } from "html-to-image";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GeneratedResult = {
  personalityType: string;
  personalitySummary: string;
  personalityTags: string[];
  letter: string;
  letterStructure?: GeneratedLetterStructure;
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
  /** Language used to generate this letter, independent from the current interface locale. */
  generationLocale?: Locale;
  /** Locale-aware identity for any future generated-letter cache. */
  generationCacheKey?: string;
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
const LETTER_THEME_STORAGE_KEY = "soul-trace-letter-theme";
const RESULT_ACTION_BUTTON_SIZE_CLASS =
  "flex min-h-[56px] w-full items-center justify-center rounded-xl px-5 py-4 text-center text-sm font-light sm:text-base";

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
const SECURE_LIFE_ARCHIVE_CONFIGURED = Boolean(
  process.env.NEXT_PUBLIC_LIFE_ARCHIVE_SECURE_MODE === "1" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
);

type SoulTraceFlowProps = {
  mode: LetterMode;
  initialResult?: GeneratedResult;
  initialServiceChannel?: ServiceChannel | null;
};

/** 살아 있는 갈래는 "지금까지" 가 곧 올해다 — 사용자가 다시 고를 이유가 없다. */
function initialYearParted(mode: LetterMode): string {
  return mode === "living" ? String(new Date().getFullYear()) : "";
}

export function SoulTraceFlow({
  mode,
  initialResult,
  initialServiceChannel = null,
}: SoulTraceFlowProps) {
  const { lang, t, messages } = useLocale();
  const copy = modeCopy(messages, mode);

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
  const [petIntro, setPetIntro] = useState<PetIntroProfile>(() => ({
    ...EMPTY_PET_INTRO,
    yearParted: initialYearParted(mode),
  }));
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [photoPrivacyConsent, setPhotoPrivacyConsent] = useState(false);
  const [mainPrivacySheetOpen, setMainPrivacySheetOpen] = useState(false);
  const [photoPrivacySheetOpen, setPhotoPrivacySheetOpen] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(initialResult ?? null);
  /** 마지막으로 생성된 편지·분석이 맞는 UI 언어 (언어 토글 시 API로 다시 맞춤) */
  const [resultLocale, setResultLocale] = useState<Locale | null>(
    initialResult?.generationLocale ?? null,
  );
  const isRestoredResult = initialResult != null;
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareableFile, setShareableFile] = useState<File | null>(null);
  const [letterThemeId, setLetterThemeId] = useState<LetterThemeId>(() => {
    if (typeof window === "undefined") return DEFAULT_LETTER_THEME_ID;
    const stored = window.localStorage.getItem(LETTER_THEME_STORAGE_KEY);
    return isLetterThemeId(stored) ? stored : DEFAULT_LETTER_THEME_ID;
  });
  const [loadedThemeImages, setLoadedThemeImages] = useState<Set<LetterThemeId>>(
    () => new Set(),
  );
  const [missingThemeImages, setMissingThemeImages] = useState<Set<LetterThemeId>>(
    () => new Set(),
  );
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 이미 편지를 받은 이메일 — 설문 진행·생성 전에 안내 */
  const [profileEmailBlockedMessage, setProfileEmailBlockedMessage] = useState<string | null>(null);
  const [isCheckingProfileEmail, setIsCheckingProfileEmail] = useState(false);
  /** 첫 생성 스트리밍 시에만 감성 로딩 한 줄 (언어 전환 시에는 null) */
  const [generationLoadingMessage, setGenerationLoadingMessage] = useState<string | null>(null);
  /** 스토리 캡처 직전 무작위로 고른 한 줄(매 공유마다 갱신) */
  const [storyShareLine, setStoryShareLine] = useState<string | null>(null);
  /**
   * 파트너 QR 의 코드(`?p=`). **partner_id 가 아니다** — 어느 파트너인지는
   * 서버가 코드를 조회해 정한다. 여기서는 그대로 실어 보내기만 한다.
   *
   * 한 번만 읽는 이유: 설문 도중 주소가 바뀌어도(뒤로가기 등) 처음 들어온
   * 유입 경로가 정본이어야 한다.
   */
  const [partnerCode] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readPartnerCode(window.location.search),
  );
  const serviceChannel = initialServiceChannel;
  const channelBackground = serviceChannelBackground(serviceChannel);
  const introduction = surveyIntroduction(messages, mode, serviceChannel);
  const surveyStepCount = memoryQuestionCount(serviceChannel) + PHOTO_STEP_COUNT + TONE_STEP_COUNT;
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [lifeArchiveBusy, setLifeArchiveBusy] = useState(false);
  const [lifeArchiveNotice, setLifeArchiveNotice] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const instagramStoryRef = useRef<HTMLDivElement>(null);
  const bgmPrimeRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!serviceChannel || isServiceChannelCompatible(serviceChannel, mode)) return;

    const destination = new URL(window.location.href);
    destination.pathname = letterModePath(serviceChannelMode(serviceChannel));
    window.location.replace(`${destination.pathname}${destination.search}${destination.hash}`);
  }, [mode, serviceChannel]);

  const letterTheme = getLetterTheme(letterThemeId);
  const selectedThemeImageMissing = missingThemeImages.has(letterThemeId);
  const selectedThemeImageReady =
    loadedThemeImages.has(letterThemeId) || selectedThemeImageMissing;

  const chooseLetterTheme = useCallback((id: LetterThemeId) => {
    setLetterThemeId(id);
    window.localStorage.setItem(LETTER_THEME_STORAGE_KEY, id);
  }, []);

  const markThemeImageLoaded = useCallback((id: LetterThemeId) => {
    setLoadedThemeImages((previous) => new Set(previous).add(id));
    setMissingThemeImages((previous) => {
      if (!previous.has(id)) return previous;
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
  }, []);

  const markThemeImageMissing = useCallback((id: LetterThemeId) => {
    setMissingThemeImages((previous) => new Set(previous).add(id));
  }, []);

  const displayPetName = letterPetName(petIntro);
  const petProfilePayload = petProfilePayloadFromIntro(petIntro);
  const letterHeading = copy.letterHeading.replace(
    "%RECIPIENT%",
    resolveRecipientAddress(petIntro, lang),
  );
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

  const continueToLifeArchive = useCallback(async () => {
    const letterId = result?.letterId;
    if (!result || lifeArchiveBusy) return;

    if (!SECURE_LIFE_ARCHIVE_CONFIGURED) {
      const petName = (result.savedPetName ?? displayPetName).trim() || "My Pet";
      const existingArchive = loadTemporaryLifeArchive();
      const reusableArchive = existingArchive?.letter === result.letter &&
        existingArchive.petName === petName
        ? existingArchive
        : null;
      saveTemporaryLifeArchive({
        archiveKey: reusableArchive?.archiveKey ?? crypto.randomUUID(),
        petName,
        letter: result.letter,
        generationLocale: result.generationLocale ?? resultLocale ?? lang,
        createdAt: reusableArchive?.createdAt ?? new Date().toISOString(),
        soulTraceMemoryCount: memoryAnswers.slice(0, MEMORY_STEP_COUNT).filter((answer) => answer.trim()).length,
        archiveMemoryCount: reusableArchive?.memories.length ?? 0,
        memories: reusableArchive?.memories ?? [],
      });
      window.location.assign("/life-archive");
      return;
    }

    if (!letterId) return;

    setLifeArchiveBusy(true);
    setLifeArchiveNotice(null);
    try {
      const response = await fetch("/api/life-archive/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId }),
      });
      const data = (await response.json()) as {
        status?: "ready" | "verification_required";
        href?: string;
      };
      if (!response.ok) throw new Error("archive access failed");

      if (data.status === "ready" && data.href === "/life-archive") {
        window.location.assign(data.href);
        return;
      }
      if (data.status === "verification_required") {
        setLifeArchiveNotice(t("result.lifeArchive.checkEmail"));
        return;
      }
      throw new Error("archive response incomplete");
    } catch {
      setLifeArchiveNotice(t("result.lifeArchive.error"));
    } finally {
      setLifeArchiveBusy(false);
    }
  }, [displayPetName, lang, lifeArchiveBusy, memoryAnswers, result, resultLocale, t]);

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
    setShowValidationErrors(false);
    setStep((prev) => Math.min(prev + 1, surveyStepCount - 1));
  }, [surveyStepCount]);

  const patchPetIntro = useCallback((patch: Partial<PetIntroProfile>) => {
    setPetIntro((prev) => ({ ...prev, ...patch }));
  }, []);

  /** SSE로 `result` 참조가 매 델타마다 바뀌면 deps에 `result`가 있을 때 effect가 반복 실행 → fetch abort → 로딩 멈춤 등 버그 유발 */
  const resultHeroUrlForLocaleSwitch = result?.heroImageUrl ?? null;
  const hasResult = result != null;

  useEffect(() => {
    // A restored letter is immutable user content. Switching UI labels must not
    // regenerate, translate, or replace its saved language.
    if (isRestoredResult) return;
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
        const surveyPayload = buildSurveyAnswers(
          messages,
          mode,
          memoryAnswers,
          tonePrefs,
          displayPetName,
          serviceChannel,
        );

        const response = await fetch("/api/generate-letter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            locale: lang,
            mode,
            channel: serviceChannel ?? undefined,
            userEmail: userEmail.trim(),
            partnerCode: partnerCode ?? undefined,
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

        setResult((previous) => ({
          ...previous,
          ...data,
          personalityTags: normalizePersonalityTags(data.personalityTags, lang),
          heroImageUrl: data.heroImageUrl ?? previous?.heroImageUrl ?? null,
          heroImageSkipped: data.heroImageSkipped === true,
          savedPetName:
            typeof data.savedPetName === "string" ? data.savedPetName : displayPetName,
        }));
        setResultLocale(data.generationLocale ?? lang);
        setShareableFile(null);
        setStoryShareLine(null);
      } catch (err) {
        const aborted =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err instanceof Error && err.name === "AbortError");
        if (cancelled || aborted) return;
        setError(userFacingErrorMessage(err, t("errors.generateFailed")));
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
    mode,
    displayPetName,
    userEmail,
    petIntro,
    privacyConsent,
    partnerCode,
    serviceChannel,
    t,
    isRestoredResult,
  ]);

  const isLastQuestion = step === surveyStepCount - 1;
  const isAnswerValid = isSurveyStepValid(step, memoryAnswers, tonePrefs, {
    hasPhoto: petPhotoFile != null,
    skipped: petPhotoSkipped,
    photoConsent: photoPrivacyConsent,
  }, serviceChannel);
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
    handleMemoryChange(step, "");
    setShowValidationErrors(false);
    setStep((prev) => Math.min(prev + 1, surveyStepCount - 1));
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
    if (!isAnswerValid) {
      setShowValidationErrors(true);
      return;
    }
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
    setShowValidationErrors(false);
    setStep((prev) => Math.min(prev + 1, surveyStepCount - 1));
  };

  const goPrev = () => {
    setShowValidationErrors(false);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const submitAnswers = async () => {
    setShowValidationErrors(true);
    if (!privacyConsent) {
      setMainPrivacySheetOpen(true);
      return;
    }
    if (!isSurveyComplete(memoryAnswers, tonePrefs, serviceChannel)) {
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
      letterStructure: createGeneratedLetterStructure(letterHeading, "", "", lang),
      heroImageUrl: null,
      heroImageSkipped: false,
      savedPetName: displayPetName,
      generationLocale: lang,
    });
    setResultLocale(lang);
    setIsLoading(true);

    try {
      const surveyPayload = buildSurveyAnswers(
        messages,
        mode,
        memoryAnswers,
        tonePrefs,
        displayPetName,
        serviceChannel,
      );

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: lang,
          mode,
          channel: serviceChannel ?? undefined,
          userEmail: userEmail.trim(),
          partnerCode: partnerCode ?? undefined,
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
              letterStructure: data.letterStructure,
              heroImageUrl: data.heroImageUrl ?? null,
              heroImageSkipped: data.heroImageSkipped === true,
              savedPetName:
                typeof data.savedPetName === "string" && data.savedPetName.trim().length > 0
                  ? data.savedPetName.trim()
                  : displayPetName,
              letterId: data.letterId ?? null,
              persistenceFailed: data.persistenceFailed === true,
              generationLocale: data.generationLocale ?? lang,
              generationCacheKey: data.generationCacheKey,
            });
            setResultLocale(data.generationLocale ?? lang);
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
        setResultLocale(data.generationLocale ?? lang);
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
    const captureNode = captureRef.current;
    if (!captureNode) return "";
    await document.fonts.ready;
    return await toJpeg(captureNode, getSnapshotOptions(skipFonts));
  };

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    try {
      setIsDownloading(true);
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
    } finally {
      setIsDownloading(false);
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
      await document.fonts.ready;
      let dataUrl: string;
      try {
        dataUrl = await toJpeg(source, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#0f1012",
          quality: CAPTURE_JPEG_QUALITY,
          skipFonts: false,
        });
      } catch {
        dataUrl = await toJpeg(source, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#0f1012",
          quality: CAPTURE_JPEG_QUALITY,
          skipFonts: true,
          fontEmbedCSS: "",
        });
      }
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
    setPetIntro({ ...EMPTY_PET_INTRO, yearParted: initialYearParted(mode) });
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
    setStoryShareLine(null);
    setShowValidationErrors(false);
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

  const canCaptureArtwork = selectedThemeImageReady;
  const activeLetterStructure = result
    ? isLoading
      ? createGeneratedLetterStructure(
          letterHeading,
          visibleStreamingBody(result.letter),
          "",
          lang,
        )
      : result.letterStructure ??
        createGeneratedLetterStructure(letterHeading, result.letter, "", lang)
    : createGeneratedLetterStructure(letterHeading, "", "", lang);
  const letterBody = activeLetterStructure.paragraphs.join("\n\n");
  const letterSplit = result ? splitLetterForDropCap(letterBody) : null;
  const dropCap = letterSplit?.first ?? "";
  const letterRest = letterSplit?.rest ?? "";
  const showChannelBackground =
    channelBackground !== null && (!result || generationLoadingMessage !== null);

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
      {showChannelBackground ? (
        <div
          data-service-channel-background={serviceChannel}
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat"
          style={{
            backgroundImage: `url(${channelBackground})`,
            backgroundPosition: "center top",
          }}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-black/35" />
        </div>
      ) : null}
      {result ? (
        <main
          className={`relative z-[1] min-h-screen pb-10 ${
            showChannelBackground ? "bg-transparent" : "bg-black"
          }`}
        >
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
            <fieldset
              data-letter-style-selector
              className="mx-auto min-w-0 w-full max-w-2xl"
            >
              <legend
                className={`mb-3 text-xs font-light tracking-[0.14em] text-[#D9C6A4] ${
                  lang === "ko" ? "font-ko" : "font-display-en"
                }`}
              >
                {t("result.letterStyle.label")}
              </legend>
              <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
                {LETTER_THEMES.map((theme) => {
                  const selected = letterThemeId === theme.id;
                  const missing = missingThemeImages.has(theme.id);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => chooseLetterTheme(theme.id)}
                      className={`relative flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs transition sm:text-sm ${
                        selected
                          ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5E6C8]"
                          : "border-white/15 bg-white/[0.03] text-[#D5CDC0] hover:border-[#D4AF37]/55 hover:text-[#F5E6C8]"
                      }`}
                    >
                      <span
                        className="relative h-6 w-8 shrink-0 overflow-hidden rounded-md border border-white/15"
                        style={{ background: theme.fallbackBackground }}
                        aria-hidden
                      >
                        {!missing ? (
                          // eslint-disable-next-line @next/next/no-img-element -- exact user-supplied public asset
                          <img
                            src={theme.backgroundImage}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                            onLoad={() => markThemeImageLoaded(theme.id)}
                            onError={() => markThemeImageMissing(theme.id)}
                          />
                        ) : null}
                      </span>
                      <span className="whitespace-nowrap" style={{ fontFamily: theme.fontFamily }}>
                        {t(theme.nameKey)}
                      </span>
                      {missing ? (
                        <span className="rounded bg-amber-200/10 px-1 py-0.5 text-[8px] uppercase tracking-wide text-amber-100/75">
                          {t("result.letterStyle.temporary")}
                        </span>
                      ) : null}
                      {selected ? (
                        <span className="text-[11px] font-bold text-[#D4AF37]" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div
              ref={captureRef}
              id="share-card"
              data-letter-preview-theme={letterTheme.id}
              className={`relative min-h-[520px] w-full overflow-hidden rounded-sm shadow-[0_0_80px_rgba(212,175,55,0.12)] ${
                isLoading ? "pointer-events-none opacity-50" : ""
              }`}
              style={{ background: letterTheme.fallbackBackground }}
            >
              {!selectedThemeImageMissing ? (
                // eslint-disable-next-line @next/next/no-img-element -- exact user-supplied public asset
                <img
                  src={letterTheme.backgroundImage}
                  alt=""
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  onLoad={() => markThemeImageLoaded(letterTheme.id)}
                  onError={() => markThemeImageMissing(letterTheme.id)}
                />
              ) : null}

              <div
                data-letter-scroll
                className="relative z-10 px-5 py-8 sm:px-8 sm:py-10 md:px-12"
              >
                <div className="flex min-h-full items-center justify-center">
                  <article
                    className="mx-auto w-full max-w-2xl rounded-[1.25rem] border px-5 py-8 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-[7px] sm:px-9 sm:py-10 md:px-12"
                    style={{
                      backgroundColor: letterTheme.overlayColor,
                      borderColor: letterTheme.panelBorderColor,
                      color: letterTheme.textColor,
                      fontFamily: letterTheme.fontFamily,
                    }}
                  >
                    <h2
                      className="text-center text-base font-semibold tracking-[0.08em] sm:text-lg"
                      style={{ color: letterTheme.headingColor }}
                    >
                      {activeLetterStructure.title || letterHeading}
                    </h2>
                    {isLoading && !result.letter.trim() ? (
                      <p className="mt-7 animate-pulse text-center text-base leading-8 opacity-75">
                        {t("result.letterStarting")}
                      </p>
                    ) : null}
                    <div
                      data-letter-body
                      className={`mt-7 whitespace-pre-line text-left text-[16px] font-normal leading-[1.85] tracking-normal sm:text-[17px] ${
                        lang === "ko" ? "break-keep" : ""
                      }`}
                    >
                      {dropCap ? (
                        <>
                          <span
                            className="float-left mr-[0.12em] mt-[0.06em] text-[3.5rem] font-semibold leading-[0.8] sm:text-[4.25rem]"
                            style={{
                              color: letterTheme.dropCapColor,
                              textShadow: "0 1px 2px rgba(0,0,0,0.18)",
                            }}
                          >
                            {dropCap}
                          </span>
                          {letterRest}
                        </>
                      ) : (
                        letterBody
                      )}
                    </div>
                    {activeLetterStructure.endingPhrase ? (
                      <p
                        data-letter-ending-phrase
                        className="mt-8 text-right text-[15px] font-semibold italic tracking-[0.04em] sm:text-base"
                        style={{ color: letterTheme.headingColor }}
                      >
                        {activeLetterStructure.endingPhrase}
                      </p>
                    ) : null}
                  </article>
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
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={!canCaptureArtwork || isDownloading || isSharing}
                  className={`${RESULT_ACTION_BUTTON_SIZE_CLASS} bg-[#b89a2e] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] disabled:cursor-not-allowed disabled:opacity-45 ${
                    lang === "ko" ? "font-ko tracking-normal" : "font-display-en"
                  }`}
                >
                  {isDownloading ? t("result.preparingImage") : t("result.keepForever")}
                </button>
                <button
                  type="button"
                  onClick={onInstagramButtonClick}
                  disabled={!canCaptureArtwork || isSharing || isDownloading}
                  className={`${RESULT_ACTION_BUTTON_SIZE_CLASS} border border-[rgba(255,255,255,0.1)] bg-[rgba(26,26,26,0.78)] text-[#F3EAD8] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[rgba(212,175,55,0.28)] hover:bg-[rgba(30,28,26,0.88)] disabled:cursor-not-allowed disabled:opacity-45 ${
                    lang === "ko" ? "font-ko tracking-normal" : "font-display-en"
                  }`}
                >
                  {isSharing ? t("result.preparingImage") : t("result.instagramShareButton")}
                </button>
                <button
                  type="button"
                  onClick={continueToLifeArchive}
                  disabled={
                    lifeArchiveBusy ||
                    (SECURE_LIFE_ARCHIVE_CONFIGURED &&
                      (!result.letterId || result.persistenceFailed))
                  }
                  className={`${RESULT_ACTION_BUTTON_SIZE_CLASS} border border-[#D4AF37]/45 bg-[#D4AF37]/[0.08] text-[#F5E6C8] transition hover:border-[#D4AF37]/75 hover:bg-[#D4AF37]/15 disabled:cursor-not-allowed disabled:opacity-45 ${
                    lang === "ko" ? "font-ko tracking-normal" : "font-display-en"
                  }`}
                >
                  {lifeArchiveBusy
                    ? t("result.lifeArchive.preparing")
                    : t("result.lifeArchive.cta")}
                </button>
              </div>
              {lifeArchiveNotice ? (
                <p className={`mt-4 whitespace-pre-line text-sm font-light leading-relaxed text-[#D9C6A4] ${lang === "ko" ? "font-ko" : "font-display-en"}`} role="status">
                  {lifeArchiveNotice}
                </p>
              ) : null}
            </div>

            <div className="mx-auto mt-12 w-full max-w-xl space-y-5">
              {/*
                편지 핸드오프. letterId 가 있을 때만 보인다 — 저장이 실패했거나
                마이그레이션 전이면 넘길 편지가 서버에 없으므로, 실패할 버튼을
                보여 주지 않는다.
              */}
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

              {result.letterId ? (
                <article
                  className={`rounded-2xl border border-[rgba(212,175,55,0.35)] bg-[rgba(24,20,14,0.82)] px-5 py-7 text-left shadow-[0_0_48px_rgba(212,175,55,0.10)] sm:px-8 sm:py-8 ${
                    lang === "ko" ? "font-ko" : "font-display-en"
                  }`}
                >
                  <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37]/95 sm:text-xs">
                    {t("result.destinationDeck.continueToEternalBeam.label")}
                  </p>
                  <h3 className="mt-3 text-[15px] font-extralight leading-snug text-[#EDE4D3] sm:text-base">
                    {t("result.destinationDeck.continueToEternalBeam.title")}
                  </h3>
                  <p className="mt-3 text-sm font-extralight leading-relaxed text-[#C4B8A8] sm:text-[15px]">
                    {t("result.destinationDeck.continueToEternalBeam.body")}
                  </p>
                  <button
                    type="button"
                    onClick={continueToEternalBeam}
                    disabled={handoffBusy}
                    className={`mt-6 flex w-full items-center justify-center rounded-2xl bg-[#b89a2e] px-5 py-3.5 text-center text-base font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] disabled:cursor-not-allowed disabled:opacity-60 ${
                      lang === "ko" ? "font-ko" : "font-display-en"
                    }`}
                  >
                    {handoffBusy
                      ? t("result.destinationDeck.continueToEternalBeam.pending")
                      : t("result.destinationDeck.continueToEternalBeam.cta")}
                  </button>
                  {handoffError ? (
                    <p className="mt-3 text-center text-sm text-red-300">{handoffError}</p>
                  ) : null}
                </article>
              ) : null}

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

            <div className="mt-8 flex items-center justify-center text-[10px] font-extralight text-[#4a4744]/95 sm:text-[11px]">
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
              theme={letterTheme}
              backgroundImageReady={
                loadedThemeImages.has(letterTheme.id) && !selectedThemeImageMissing
              }
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
      <main
        className={`relative isolate z-[1] flex min-h-screen flex-col ${
          showChannelBackground ? "bg-transparent" : "bg-black"
        }`}
      >
        <WarmRisingSparkles />
        <header className="relative z-[2] flex w-full shrink-0 items-center justify-between px-5 pt-6 md:px-8 md:pt-8">
          {/* 갈래를 잘못 골랐을 때 되돌아갈 길 — 없으면 새로고침밖에 방법이 없다. */}
          <Link
            href="/choose"
            className={`text-xs font-extralight text-[#EDE4D3]/60 transition hover:text-[#D4AF37] ${
              lang === "ko" ? "font-ko" : "font-display-en"
            }`}
          >
            {t("landing.back")}
          </Link>
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
              <p className="whitespace-pre-line">{introduction.headline}</p>
              <p>{introduction.subline}</p>
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
                aria-invalid={showValidationErrors && !isEmailValid}
                aria-describedby={showValidationErrors && !isEmailValid ? "email-error" : undefined}
                className={`font-ko w-full rounded-xl border-[0.5px] bg-transparent px-4 py-3 text-base font-extralight text-[#FFFFFF] outline-none transition placeholder:text-[#EDE4D3]/50 md:text-sm ${
                  showValidationErrors && !isEmailValid
                    ? "border-red-300/75 focus:border-red-300"
                    : "border-[rgba(212,175,55,0.35)] focus:border-[#D4AF37]"
                }`}
              />
              {showValidationErrors && !isEmailValid ? (
                <p id="email-error" className="text-xs font-extralight text-red-200" role="alert">
                  {userEmail.trim()
                    ? t("form.validation.emailInvalid")
                    : t("form.validation.emailRequired")}
                </p>
              ) : null}
              </div>
              <PetIntroForm
                mode={mode}
                profile={petIntro}
                onChange={patchPetIntro}
                showErrors={showValidationErrors}
              />
              <PrivacyConsentTrigger
                agreed={privacyConsent}
                onOpen={() => setMainPrivacySheetOpen(true)}
                labelPath="form.privacyConsentLink"
              />
              {showValidationErrors && !privacyConsent ? (
                <p className="text-xs font-extralight text-red-200" role="alert">
                  {t("form.validation.privacyRequired")}
                </p>
              ) : null}
            </div>

            <PrivacyConsentSheet
              open={mainPrivacySheetOpen}
              onClose={() => setMainPrivacySheetOpen(false)}
              titlePath="form.privacyConsentTitle"
              bodyPath="form.privacyConsentBody"
              agreePath="form.privacyConsentAgree"
              checked={privacyConsent}
              onConfirm={() => setPrivacyConsent(true)}
            />

            <PrivacyConsentSheet
              open={photoPrivacySheetOpen}
              onClose={() => setPhotoPrivacySheetOpen(false)}
              titlePath="form.photoPrivacyConsentTitle"
              bodyPath="form.photoPrivacyConsentBody"
              agreePath="form.photoPrivacyConsentAgree"
              checked={photoPrivacyConsent}
              onConfirm={() => setPhotoPrivacyConsent(true)}
            />

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
                mode={mode}
                serviceChannel={serviceChannel}
                step={step}
                petDisplayName={displayPetName}
                memoryAnswers={memoryAnswers}
                tonePrefs={tonePrefs}
                petPhotoPreviewUrl={petPhotoPreviewUrl}
                onPetPhotoChange={onPetPhotoChange}
                onSkipPhoto={handleSkipPhoto}
                photoPrivacyConsent={photoPrivacyConsent}
                onOpenPhotoPrivacy={() => setPhotoPrivacySheetOpen(true)}
                videoMotion={videoMotion}
                onVideoMotionChange={setVideoMotion}
                onMemoryChange={handleMemoryChange}
                onToneMood={(mood) => setTonePrefs((prev) => ({ ...prev, mood }))}
                onToneOptionToggle={handleToneOptionToggle}
                onToneLength={(length) => setTonePrefs((prev) => ({ ...prev, length }))}
                onSkipOptional={handleSkipOptional}
                showValidationError={showValidationErrors && !isAnswerValid}
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
                  disabled={isLoading || Boolean(profileEmailBlockedMessage)}
                  className="font-ko min-h-[44px] rounded-xl bg-[#b89a2e] px-4 py-3 text-sm font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? t("buttons.generating") : t("buttons.generate")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  disabled={
                    step === 0 &&
                      isEmailValid &&
                      (!!profileEmailBlockedMessage || isCheckingProfileEmail)
                  }
                  className="font-ko min-h-[44px] rounded-xl border-[0.5px] border-[rgba(212,175,55,0.55)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] active:bg-[rgba(212,175,55,0.1)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {t("buttons.next")}
                </button>
              )}
            </div>
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
