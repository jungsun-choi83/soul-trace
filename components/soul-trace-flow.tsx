"use client";

import { QuestionnairePrivacyNotice } from "@/components/questionnaire-privacy-notice";
import { petIntroQuestionIds, PetIntroForm } from "@/components/pet-intro-form";
import { SurveyFlow } from "@/components/survey-flow";
import { WarmRisingSparkles } from "@/components/warm-rising-sparkles";
import { InstagramStoryCard } from "@/components/instagram-story-card";
import { LanguageToggle } from "@/components/language-toggle";
import { ResultAmbientAudio } from "@/components/result-ambient-audio";
import { LetterPostageStamp } from "@/components/letter-postage-stamp";
import { InkWordReveal } from "@/components/ink-word-reveal";
import { useBufferedInkReveal } from "@/components/use-buffered-ink-reveal";
import {
  englishLetterBodyFont,
  englishLetterOpeningFont,
  koreanLetterFont,
} from "@/components/generated-letter-fonts";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { letterModePath, modeCopy, type LetterMode } from "@/lib/letter-mode";
import Link from "next/link";
import Image from "next/image";
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
import { pickEmotionalLetterSentence, pickRandomBestLetterSentence } from "@/lib/letter-emotional-line";
import {
  createGeneratedLetterStructure,
  visibleStreamingBody,
} from "@/lib/generated-letter";
import {
  DEFAULT_LETTER_THEME_ID,
  getLetterTheme,
  isLetterThemeId,
  LETTER_THEMES,
  type LetterThemeId,
} from "@/lib/letter-themes";
import { getEternalBeamInstagramUrl, getEternalBeamMainUrl, getEternalBeamYoutubeUrl } from "@/lib/eternalbeam-urls";
import {
  buildLetterRequestFields,
  EMPTY_PET_INTRO,
  isPetIntroComplete,
  letterPetName,
  resolveRecipientAddress,
  type PetIntroProfile,
} from "@/lib/pet-profile";
import { getQuestionnairePetTheme } from "@/lib/pet-theme";
import { resolveDefaultStampByPetType, resolveStampType } from "@/lib/stamp";
import { resolveLetterLanguage } from "@/lib/letter-language";
import { formatLetterCreationDate, letterSignatureName } from "@/lib/letter-signature";
import {
  buildInkRevealPlan,
  completeStreamedLetterPrefix,
  shouldStartBufferedReveal,
} from "@/lib/ink-word-reveal";
import {
  completedResultKey,
  parseCompletedResult,
  type CompletedResultSession,
  type SessionGeneratedResult,
} from "@/lib/completed-result-session";
import {
  parseQuestionnaireDraft,
  QUESTIONNAIRE_DRAFT_VERSION,
  questionnaireDraftKey,
  type QuestionnaireDraft,
} from "@/lib/questionnaire-draft";
import {
  isValidQuestionnaireEmail,
  normalizeQuestionnaireEmail,
} from "@/lib/questionnaire-email";
import { requiredPrivacyItemsAgreed, setAllPrivacyItems, EMPTY_PRIVACY_SELECTIONS, type PrivacySectionKey, type PrivacySelections } from "@/lib/privacy-consent-selection";
import {
  buildSurveyAnswers,
  channelMemoryQuestions,
  EMPTY_TONE_PREFS,
  isSurveyComplete,
  isSurveyStepValid,
  MEMORY_STEP_COUNT,
  PHOTO_STEP_COUNT,
  surveyIntroduction,
  type LetterTonePrefs,
} from "@/lib/survey";
import { toJpeg } from "html-to-image";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FaFacebookF, FaInstagram, FaLine, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { HiOutlineLink } from "react-icons/hi2";

export type GeneratedResult = SessionGeneratedResult;

type ShareOption = {
  label: string;
  icon: ReactNode;
  className: string;
  action: () => void;
  disabled?: boolean;
};

/** 생성된 첫 줄(호칭/인사말)만 본문과 다른 손글씨체로 표현한다. */
function splitLetterOpening(letter: string): { opening: string; body: string } {
  const trimmed = letter.trimStart();
  if (!trimmed) {
    return { opening: "", body: "" };
  }
  const firstLineEnd = trimmed.indexOf("\n");
  if (firstLineEnd === -1) {
    return { opening: trimmed, body: "" };
  }
  return {
    opening: trimmed.slice(0, firstLineEnd).trimEnd(),
    body: trimmed.slice(firstLineEnd).trimStart(),
  };
}

/** JPEG가 PNG보다 용량·인코딩 시간에 유리. pixelRatio 2로 디코드 부담 완화 */
const CAPTURE_JPEG_QUALITY = 0.88;
const CAPTURE_PIXEL_RATIO = 2;
const LETTER_THEME_STORAGE_KEY = "soul-trace-letter-theme";
const KICKSTARTER_URL = process.env.NEXT_PUBLIC_KICKSTARTER_URL?.trim() || null;
const ETERNAL_BEAM_YOUTUBE_URL = getEternalBeamYoutubeUrl();
const TIKTOK_WEBSITE_URL = "https://www.tiktok.com/login";
const KAKAOTALK_WEBSITE_URL = "https://accounts.kakao.com/login";

function KakaoTalkMark() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-6 w-7 items-center justify-center rounded-[42%] bg-[#FEE500] text-[6px] font-black leading-none tracking-[-0.08em] text-[#191919] after:absolute after:bottom-[-2px] after:left-[5px] after:border-r-[4px] after:border-t-[4px] after:border-r-transparent after:border-t-[#FEE500]"
    >
      TALK
    </span>
  );
}

function AnnouncementIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <path d="M4 13.5v-3l11-4.5v12L4 13.5Z" />
      <path d="M15 9.2c2 .7 3 1.6 3 2.8s-1 2.1-3 2.8M6.5 14.5l1.2 4h3.1l-1.8-3" />
    </svg>
  );
}

function KickstarterAnnouncement({ locale }: { locale: Locale }) {
  const content = (
    <>
      <AnnouncementIcon />
      <span className="truncate whitespace-nowrap">
        {locale === "ko" ? "곧 Kickstarter에서 만나요" : "Launching soon on Kickstarter"}
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 shrink-0"
      >
        <path d="m6 3.5 4.5 4.5L6 12.5" />
      </svg>
    </>
  );
  const className = `flex h-11 w-full items-center justify-center gap-2 overflow-hidden border-b border-[#143524] bg-[#070A08] px-4 text-center text-xs font-medium text-[#05CE78] sm:text-sm ${
    locale === "ko" ? "font-ko" : "font-sans"
  }`;

  return (
    <a
      href="#kickstarter-promo"
      onClick={(event) => {
        event.preventDefault();
        document.getElementById("kickstarter-promo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={`${className} transition hover:bg-[#0A110D] hover:text-[#19E589] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#05CE78]`}
    >
      {content}
    </a>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.15em] shrink-0"
    >
      <path d="M12 3v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[1.15em] shrink-0"
    >
      <path d="m4 12 16-8-6.5 16-2.8-6.7L4 12Z" />
      <path d="m10.7 13.3 4.8-4.8" />
    </svg>
  );
}

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
type SoulTraceFlowProps = {
  mode: LetterMode;
  initialResult?: GeneratedResult;
  initialServiceChannel?: ServiceChannel | null;
  initialPetId?: string | null;
  hasEternalBeamAccess?: boolean;
};

/** 살아 있는 갈래는 "지금까지" 가 곧 올해다 — 사용자가 다시 고를 이유가 없다. */
function initialYearParted(mode: LetterMode): string {
  return mode === "living" ? String(new Date().getFullYear()) : "";
}

export function SoulTraceFlow({
  mode,
  initialResult,
  initialServiceChannel = null,
  initialPetId = null,
}: SoulTraceFlowProps) {
  const { lang, t, messages } = useLocale();
  const copy = modeCopy(messages, mode);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [memoryAnswers, setMemoryAnswers] = useState<string[]>(() =>
    Array(MEMORY_STEP_COUNT).fill(""),
  );
  const [tonePrefs, setTonePrefs] = useState<LetterTonePrefs>(() => ({ ...EMPTY_TONE_PREFS }));
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [petPhotoPreviewUrl, setPetPhotoPreviewUrl] = useState<string | null>(null);
  const [petPhotoSkipped, setPetPhotoSkipped] = useState(false);
  const [email, setEmail] = useState("");
  const [petIntro, setPetIntro] = useState<PetIntroProfile>(() => ({
    ...EMPTY_PET_INTRO,
    yearParted: initialYearParted(mode),
  }));
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacySelections, setPrivacySelections] = useState<PrivacySelections>(() => ({ ...EMPTY_PRIVACY_SELECTIONS }));
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(initialResult ?? null);
  const [animateFreshLetter, setAnimateFreshLetter] = useState(false);
  const generationTimingRef = useRef<{
    requestStartedAt: number;
    firstChunkAt?: number;
    firstCompleteWordAt?: number;
    bufferReadyAt?: number;
    generationDoneAt?: number;
  } | null>(null);
  const generationCreatedAtRef = useRef<string | null>(null);
  const [draftReady, setDraftReady] = useState(initialResult != null);
  /** 마지막으로 생성된 편지·분석이 맞는 UI 언어 (언어 토글 시 API로 다시 맞춤) */
  const [resultLocale, setResultLocale] = useState<Locale | null>(
    initialResult?.generationLocale ?? null,
  );
  const isRestoredResult = initialResult != null || result != null;
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareTrayOpen, setShareTrayOpen] = useState(false);
  const shareTrayRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
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
  const draftStorageKey = useMemo(
    () => questionnaireDraftKey(mode, serviceChannel),
    [mode, serviceChannel],
  );
  const resultStorageKey = useMemo(
    () => completedResultKey(mode, serviceChannel),
    [mode, serviceChannel],
  );
  const channelBackground = serviceChannelBackground(serviceChannel);
  const introduction = surveyIntroduction(messages, mode, serviceChannel);
  const memoryCount = channelMemoryQuestions(messages, serviceChannel)?.length ?? copy.memory.length;
  const surveyStepCount = memoryCount + PHOTO_STEP_COUNT + copy.tone.length;
  const introQuestions = petIntroQuestionIds(petIntro.petType);
  const introQuestionCount = introQuestions.length;
  const petTypeQuestionIndex = introQuestions.indexOf("type");
  const petTypeQuestionCompleted =
    petTypeQuestionIndex >= 0 && questionIndex > petTypeQuestionIndex;
  const questionnairePetTheme = getQuestionnairePetTheme(
    petIntro.petType,
    petTypeQuestionCompleted,
  );
  const emailQuestionIndex = introQuestionCount + surveyStepCount;
  const totalQuestionCount = emailQuestionIndex + 1;
  const isIntroQuestion = questionIndex < introQuestionCount;
  const isSurveyQuestion = questionIndex >= introQuestionCount && questionIndex < introQuestionCount + surveyStepCount;
  const isEmailQuestion = questionIndex === emailQuestionIndex;
  const step = questionIndex - introQuestionCount;
  const isStampPhotoQuestion = PHOTO_STEP_COUNT === 1 && isSurveyQuestion && step === surveyStepCount - 1;
  const questionsLeft = Math.max(totalQuestionCount - questionIndex - 1, 0);
  const captureRef = useRef<HTMLDivElement>(null);
  const instagramStoryRef = useRef<HTMLDivElement>(null);
  const bgmPrimeRef = useRef<HTMLAudioElement>(null);
  const privacyTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!serviceChannel || isServiceChannelCompatible(serviceChannel, mode)) return;

    const destination = new URL(window.location.href);
    destination.pathname = letterModePath(serviceChannelMode(serviceChannel));
    window.location.replace(`${destination.pathname}${destination.search}${destination.hash}`);
  }, [mode, serviceChannel]);

  useEffect(() => {
    if (initialResult) {
      setDraftReady(true);
      return;
    }
    if (serviceChannel && !isServiceChannelCompatible(serviceChannel, mode)) {
      setDraftReady(true);
      return;
    }

    try {
      const completed = parseCompletedResult(
        window.sessionStorage.getItem(resultStorageKey),
        mode,
        serviceChannel,
      );
      if (completed) {
        setResult(completed.result);
        setResultLocale(completed.resultLocale);
        setPetIntro(completed.petIntro);
        setMemoryAnswers(completed.memoryAnswers);
        return;
      }

      const restored = parseQuestionnaireDraft(
        window.sessionStorage.getItem(draftStorageKey),
        mode,
        serviceChannel,
      );
      if (restored) {
        const restoredIntroCount = petIntroQuestionIds(restored.petIntro.petType).length;
        const restoredEmailIndex = restoredIntroCount + surveyStepCount;
        const restoredTotal = restoredEmailIndex + 1;
        setPetIntro(restored.petIntro);
        setMemoryAnswers(restored.memoryAnswers);
        setTonePrefs(restored.tonePrefs);
        setPetPhotoSkipped(restored.petPhotoSkipped);
        setPrivacyConsent(restored.privacyConsent);
        setPrivacySelections(restored.privacySelections);
        setEmail(restored.email);
        setQuestionIndex(
          !restored.privacyConsent && restored.questionIndex > restoredEmailIndex
            ? restoredEmailIndex
            : Math.min(restored.questionIndex, Math.max(restoredTotal - 1, 0)),
        );
      }
    } catch {
      // sessionStorage can be unavailable in restricted/private browsing contexts.
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey, initialResult, mode, resultStorageKey, serviceChannel, surveyStepCount]);

  useEffect(() => {
    if (!draftReady || initialResult || result) return;
    const hasMeaningfulProgress =
      questionIndex > 0 ||
      Boolean(
        petIntro.petName ||
        petIntro.petNickname ||
        petIntro.petGender ||
        petIntro.petType ||
        petIntro.petBreed ||
        petIntro.petAge ||
        petIntro.yearMet ||
        petIntro.letterRecipient ||
        petIntro.letterRecipientDetail,
      ) ||
      memoryAnswers.some(Boolean) ||
      Boolean(tonePrefs.mood || tonePrefs.length || tonePrefs.options.length) ||
      petPhotoSkipped ||
      Boolean(email.trim()) ||
      privacyConsent;
    if (!hasMeaningfulProgress) {
      try {
        window.sessionStorage.removeItem(draftStorageKey);
      } catch {
        // The empty flow is still valid when browser storage is unavailable.
      }
      return;
    }
    const draft: QuestionnaireDraft = {
      version: QUESTIONNAIRE_DRAFT_VERSION,
      mode,
      channel: serviceChannel,
      questionIndex,
      petIntro,
      memoryAnswers,
      tonePrefs,
      petPhotoSkipped,
      privacyConsent,
      privacySelections,
      email,
    };
    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Keep the questionnaire usable when browser storage is unavailable or full.
    }
  }, [
    draftReady,
    draftStorageKey,
    email,
    initialResult,
    memoryAnswers,
    mode,
    petIntro,
    petPhotoSkipped,
    privacyConsent,
    privacySelections,
    questionIndex,
    result,
    serviceChannel,
    tonePrefs,
  ]);

  const clearQuestionnaireDraft = useCallback(() => {
    try {
      window.sessionStorage.removeItem(draftStorageKey);
    } catch {
      // Reset/completion still succeeds if browser storage is unavailable.
    }
  }, [draftStorageKey]);

  const persistCompletedResult = useCallback((completedResult: GeneratedResult) => {
    const completed: CompletedResultSession = {
      version: 1,
      mode,
      channel: serviceChannel,
      resultLocale: completedResult.generationLocale ?? lang,
      petIntro,
      memoryAnswers,
      result: completedResult,
    };
    try {
      window.sessionStorage.setItem(resultStorageKey, JSON.stringify(completed));
    } catch {
      // The in-memory result remains usable when browser storage is unavailable or full.
    }
  }, [lang, memoryAnswers, mode, petIntro, resultStorageKey, serviceChannel]);

  const clearCompletedResult = useCallback(() => {
    try {
      window.sessionStorage.removeItem(resultStorageKey);
    } catch {
      // Starting over still succeeds if browser storage is unavailable.
    }
  }, [resultStorageKey]);

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
  const letterHeading = copy.letterHeading.replace(
    "%RECIPIENT%",
    resolveRecipientAddress(petIntro, lang),
  );
  const officialSiteUrl = useMemo(() => getEternalBeamMainUrl(), []);
  const instagramProfileUrl = useMemo(() => getEternalBeamInstagramUrl(), []);

  useEffect(() => {
    if (!shareTrayOpen) return;
    const closeShareTray = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setShareTrayOpen(false);
        return;
      }
      if (!shareTrayRef.current?.contains(event.target as Node)) {
        setShareTrayOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeShareTray);
    window.addEventListener("keydown", closeShareTray);
    return () => {
      document.removeEventListener("pointerdown", closeShareTray);
      window.removeEventListener("keydown", closeShareTray);
    };
  }, [shareTrayOpen]);

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
    setPrivacyConsent(false);
  }, []);

  const handleSkipPhoto = useCallback(() => {
    setPetPhotoFile(null);
    setPetPhotoSkipped(true);
    setPrivacyConsent(false);
    setShowValidationErrors(false);
    privacyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPrivacyModalOpen(true);
  }, []);

  const persistStampSelection = useCallback(async (letterId: string | null | undefined) => {
    if (!letterId) return;
    const stampType = resolveStampType(petIntro.petType, Boolean(petPhotoFile && privacyConsent));
    const form = new FormData();
    form.set("letterId", letterId);
    form.set("email", normalizeQuestionnaireEmail(email));
    form.set("stampType", stampType);
    if (stampType === "photo" && petPhotoFile) form.set("stampPhoto", petPhotoFile);
    try {
      const response = await fetch("/api/stamp-photo", { method: "POST", body: form });
      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        console.error("[stamp-photo] Could not persist the stamp selection.", {
          status: response.status,
          statusText: response.statusText,
          responseBody: responseBody || "(empty response)",
        });
      }
    } catch (error) {
      console.error("[stamp-photo] Request failed before receiving a response.", {
        message: error instanceof Error ? error.message : "Unknown network error",
      });
    }
  }, [email, petIntro.petType, petPhotoFile, privacyConsent]);

  const patchPetIntro = useCallback((patch: Partial<PetIntroProfile>) => {
    setPrivacyConsent(false);
    setPetIntro((prev) => ({ ...prev, ...patch }));
  }, []);

  /** SSE로 `result` 참조가 매 델타마다 바뀌면 deps에 `result`가 있을 때 effect가 반복 실행 → fetch abort → 로딩 멈춤 등 버그 유발 */
  const resultHeroUrlForLocaleSwitch = result?.heroImageUrl ?? null;
  const resultLetterIdForLocaleSwitchRef = useRef<string | null>(result?.letterId ?? null);
  resultLetterIdForLocaleSwitchRef.current = result?.letterId ?? null;
  const resultPetIdForLocaleSwitchRef = useRef<string | null>(result?.petId ?? initialPetId);
  resultPetIdForLocaleSwitchRef.current = result?.petId ?? initialPetId;
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
            letterId: resultLetterIdForLocaleSwitchRef.current ?? undefined,
            petId: resultPetIdForLocaleSwitchRef.current ?? undefined,
            locale: lang,
            mode,
            channel: serviceChannel ?? undefined,
            partnerCode: partnerCode ?? undefined,
            email: normalizeQuestionnaireEmail(email),
            privacyConsent: true,
            ...buildLetterRequestFields(petIntro, tonePrefs)!,
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
    email,
    petIntro,
    partnerCode,
    serviceChannel,
    t,
    isRestoredResult,
  ]);

  const isLastQuestion = questionIndex === totalQuestionCount - 1;
  const isProfileValid = isPetIntroComplete(petIntro);
  const introQuestionId = introQuestions[questionIndex] ?? "name";
  const isIntroAnswerValid =
    introQuestionId === "name" ? Boolean(petIntro.petName.trim()) :
    introQuestionId === "gender" ? Boolean(petIntro.petGender) :
    introQuestionId === "type" ? Boolean(petIntro.petType) :
    introQuestionId === "breed" ? Boolean(petIntro.petBreed) :
    introQuestionId === "years" ? /^\d+$/.test(petIntro.petAge ?? "") :
    introQuestionId === "recipient" ? Boolean(
      petIntro.letterRecipient &&
      ((petIntro.letterRecipient !== "byName" && petIntro.letterRecipient !== "custom") ||
        petIntro.letterRecipientDetail.trim())
    ) : false;
  const isAnswerValid = isEmailQuestion
    ? isValidQuestionnaireEmail(email)
    : isIntroQuestion
      ? isIntroAnswerValid
      : isSurveyStepValid(step, memoryAnswers, tonePrefs, {
        hasPhoto: petPhotoFile != null,
        skipped: petPhotoSkipped,
        photoConsent: true,
      }, messages, mode, serviceChannel);

  const handleMemoryChange = (index: number, value: string) => {
    setPrivacyConsent(false);
    setMemoryAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSkipOptional = () => {
    handleMemoryChange(step, "");
    setShowValidationErrors(false);
    setQuestionIndex((prev) => Math.min(prev + 1, totalQuestionCount - 1));
  };

  const handleToneMood = (mood: LetterTonePrefs["mood"]) => {
    setPrivacyConsent(false);
    setTonePrefs((prev) => ({ ...prev, mood }));
  };

  const handleToneLength = (length: LetterTonePrefs["length"]) => {
    setPrivacyConsent(false);
    setTonePrefs((prev) => ({ ...prev, length }));
  };

  const goNext = async () => {
    if (!isAnswerValid) {
      setShowValidationErrors(true);
      return;
    }
    setShowValidationErrors(false);
    if (isStampPhotoQuestion) {
      privacyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPrivacyModalOpen(true);
      return;
    }
    setQuestionIndex((prev) => Math.min(prev + 1, totalQuestionCount - 1));
  };

  const goPrev = () => {
    setShowValidationErrors(false);
    setQuestionIndex((prev) => Math.max(prev - 1, 0));
  };

  const confirmPrivacyNotice = () => {
    if (!requiredPrivacyItemsAgreed(privacySelections)) return;
    setPrivacyConsent(true);
    setPrivacyModalOpen(false);
    setShowValidationErrors(false);
    setQuestionIndex(emailQuestionIndex);
  };

  const changePrivacySelection = (key: PrivacySectionKey, checked: boolean) => {
    setPrivacySelections((current) => {
      const next = { ...current, [key]: checked };
      setPrivacyConsent(next.privacy);
      return next;
    });
  };

  const agreeToAllPrivacy = (checked: boolean) => {
    setPrivacySelections(setAllPrivacyItems(checked));
    setPrivacyConsent(checked);
  };

  const closePrivacyNotice = useCallback(() => {
    setPrivacyModalOpen(false);
    window.requestAnimationFrame(() => privacyTriggerRef.current?.focus());
  }, []);

  const submitAnswers = async () => {
    setShowValidationErrors(true);
    if (!privacyConsent) {
      privacyTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPrivacyModalOpen(true);
      return;
    }
    if (!isAnswerValid) return;
    const normalizedEmail = normalizeQuestionnaireEmail(email);
    setEmail(normalizedEmail);
    if (!isSurveyComplete(memoryAnswers, tonePrefs, messages, mode, serviceChannel)) {
      return;
    }
    if (!isProfileValid) {
      setError(t("errors.profileIncomplete"));
      return;
    }

    setError(null);
    await primeResultBgm(bgmPrimeRef);

    setError(null);
    setShareableFile(null);
    setStoryShareLine(null);
    setGenerationLoadingMessage(pickGenerationLoadingMessage(lang, displayPetName));
    setAnimateFreshLetter(true);
    generationCreatedAtRef.current = new Date().toISOString();
    setResult({
      personalityType: "",
      personalitySummary: "",
      personalityTags: [],
      letter: "",
      letterStructure: createGeneratedLetterStructure(letterHeading, "", "", lang),
      heroImageUrl: null,
      heroImageSkipped: false,
      savedPetName: displayPetName,
      createdAt: generationCreatedAtRef.current,
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

      generationTimingRef.current = { requestStartedAt: performance.now() };
      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locale: lang,
          petId: initialPetId ?? undefined,
          mode,
          channel: serviceChannel ?? undefined,
          partnerCode: partnerCode ?? undefined,
          email: normalizedEmail,
          privacyConsent: true,
          ...buildLetterRequestFields(petIntro, tonePrefs)!,
          answers: surveyPayload,
          stream: true,
          ...(SKIP_FIRST_HERO_IMAGE
            ? { skipImageGeneration: true, existingHeroImageUrl: null as string | null }
            : {}),
        }),
      });
      if (process.env.NODE_ENV === "development") {
        console.debug("[letter-timing] SSE response opened", {
          elapsedMs: Math.round(performance.now() - generationTimingRef.current.requestStartedAt),
        });
      }

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? t("errors.generateFailed"));
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        let timingStreamText = "";
        await consumeLetterSseStream(response, {
          onLetterDelta: (delta) => {
            if (generationTimingRef.current && generationTimingRef.current.firstChunkAt === undefined) {
              generationTimingRef.current.firstChunkAt = performance.now();
              if (process.env.NODE_ENV === "development") {
                console.debug("[letter-timing] first text chunk", {
                  elapsedMs: Math.round(
                    generationTimingRef.current.firstChunkAt - generationTimingRef.current.requestStartedAt,
                  ),
                });
              }
            }
            if (process.env.NODE_ENV === "development" && generationTimingRef.current) {
              timingStreamText += delta;
              const completeText = completeStreamedLetterPrefix(timingStreamText);
              if (generationTimingRef.current.firstCompleteWordAt === undefined && completeText.trim()) {
                generationTimingRef.current.firstCompleteWordAt = performance.now();
                console.debug("[letter-timing] first complete word buffered", {
                  elapsedMs: Math.round(
                    generationTimingRef.current.firstCompleteWordAt -
                      generationTimingRef.current.requestStartedAt,
                  ),
                });
              }
              if (
                generationTimingRef.current.bufferReadyAt === undefined &&
                shouldStartBufferedReveal(completeText, false)
              ) {
                generationTimingRef.current.bufferReadyAt = performance.now();
                console.debug("[letter-timing] handwriting buffer ready", {
                  elapsedMs: Math.round(
                    generationTimingRef.current.bufferReadyAt -
                      generationTimingRef.current.requestStartedAt,
                  ),
                });
              }
            }
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
            if (generationTimingRef.current) {
              generationTimingRef.current.generationDoneAt = performance.now();
              if (process.env.NODE_ENV === "development") {
                console.debug("[letter-timing] completed payload received", {
                  elapsedMs: Math.round(
                    generationTimingRef.current.generationDoneAt - generationTimingRef.current.requestStartedAt,
                  ),
                });
              }
            }
            const completedResult: GeneratedResult = {
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
              createdAt: data.createdAt ?? generationCreatedAtRef.current,
              letterId: data.letterId ?? null,
              petId: data.petId ?? initialPetId,
              persistenceFailed: data.persistenceFailed === true,
              generationLocale: data.generationLocale ?? lang,
              generationCacheKey: data.generationCacheKey,
            };
            persistCompletedResult(completedResult);
            clearQuestionnaireDraft();
            setResult(completedResult);
            setResultLocale(data.generationLocale ?? lang);
            void persistStampSelection(data.letterId);
          },
        });
      } else {
        const data = (await response.json()) as GeneratedResult;
        const completedResult: GeneratedResult = {
          ...data,
          personalityTags: normalizePersonalityTags(data.personalityTags, lang),
          heroImageUrl: data.heroImageUrl ?? null,
          heroImageSkipped: data.heroImageSkipped === true,
          savedPetName: typeof data.savedPetName === "string" ? data.savedPetName : displayPetName,
          generationLocale: data.generationLocale ?? lang,
          createdAt: data.createdAt ?? generationCreatedAtRef.current,
        };
        persistCompletedResult(completedResult);
        clearQuestionnaireDraft();
        setResult(completedResult);
        setResultLocale(data.generationLocale ?? lang);
        void persistStampSelection(data.letterId);
      }
    } catch (err) {
      stopResultBgm(bgmPrimeRef);
      setResult(null);
      setResultLocale(null);
      setAnimateFreshLetter(false);
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

    const openInstagramWebsite = () => {
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
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
      openInstagramWebsite();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        openInstagramWebsite();
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

  const openShareUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareCurrentPage = (platform: "facebook" | "line" | "x") => {
    const url = encodeURIComponent(window.location.href);
    openShareUrl(
      platform === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${url}`
        : platform === "line"
          ? `https://social-plugins.line.me/lineit/share?url=${url}`
          : `https://x.com/intent/post?url=${url}`,
    );
  };

  const copyResultLink = () => {
    void navigator.clipboard.writeText(window.location.href).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : t("errors.shareFailed"));
    });
  };

  const goBackFromResult = () => {
    if (!initialResult) {
      setResult(null);
      setResultLocale(null);
      setAnimateFreshLetter(false);
      setShareableFile(null);
      setError(null);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.assign(letterModePath(mode));
  };

  const resetTest = () => {
    clearQuestionnaireDraft();
    clearCompletedResult();
    setQuestionIndex(0);
    setMemoryAnswers(Array(MEMORY_STEP_COUNT).fill(""));
    setTonePrefs({ ...EMPTY_TONE_PREFS });
    setPetPhotoFile(null);
    setPetPhotoSkipped(false);
    setEmail("");
    setPetIntro({ ...EMPTY_PET_INTRO, yearParted: initialYearParted(mode) });
    setPrivacyConsent(false);
    setPrivacySelections({ ...EMPTY_PRIVACY_SELECTIONS });
    setPrivacyModalOpen(false);
    setResult(null);
    setResultLocale(null);
    setAnimateFreshLetter(false);
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
  const completedLetterBody = activeLetterStructure.paragraphs.join("\n\n");
  const finalRevealText = completedLetterBody;
  const noteFirstWordVisible = useCallback(() => {
    if (process.env.NODE_ENV !== "development" || !generationTimingRef.current) return;
    console.debug("[letter-timing] first handwritten word", {
      elapsedMs: Math.round(performance.now() - generationTimingRef.current.requestStartedAt),
      afterFirstChunkMs: generationTimingRef.current.firstChunkAt === undefined
        ? undefined
        : Math.round(performance.now() - generationTimingRef.current.firstChunkAt),
    });
  }, []);
  const bufferedReveal = useBufferedInkReveal({
    streamedText: isLoading ? result?.letter ?? "" : finalRevealText,
    finalText: finalRevealText,
    active: animateFreshLetter,
    generationComplete: !isLoading,
    onRevealStart: noteFirstWordVisible,
  });
  const visibleLetterBody = isLoading
    ? bufferedReveal.visibleText
    : bufferedReveal.visibleText.slice(0, Math.min(bufferedReveal.visibleText.length, completedLetterBody.length));
  const letterLanguage = resolveLetterLanguage(result?.generationLocale, resultLocale);
  const signatureDate = formatLetterCreationDate(result?.createdAt, letterLanguage);
  const signatureName = letterSignatureName(result?.savedPetName ?? displayPetName);
  const letterSplit = result ? splitLetterOpening(visibleLetterBody) : null;
  const letterOpening = letterSplit?.opening ?? "";
  const letterBodyAfterOpening = letterSplit?.body ?? "";
  const inkRevealPlan = useMemo(
    () => buildInkRevealPlan([
      letterOpening,
      letterBodyAfterOpening,
      "",
    ]),
    [letterBodyAfterOpening, letterOpening],
  );
  const animateLetterWords = animateFreshLetter;
  const showChannelBackground =
    channelBackground !== null && (!result || generationLoadingMessage !== null);

  if (!draftReady) {
    return <main className="min-h-screen bg-black" aria-busy="true" aria-label="Restoring questionnaire" />;
  }

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
          <KickstarterAnnouncement locale={lang} />
          <WarmRisingSparkles />
          <header className="relative z-[2] flex w-full items-center justify-between px-4 pt-6 sm:px-6">
            <button
              type="button"
              onClick={goBackFromResult}
              aria-label={t("landing.navBack")}
              className={`flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 text-sm font-light text-[#EDE4D3]/80 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37] ${
                lang === "ko" ? "font-ko" : "font-display-en"
              }`}
            >
              <span aria-hidden className="text-xl">←</span>
              <span>{t("landing.navBack")}</span>
            </button>
            <LanguageToggle />
          </header>
          <section className="relative z-[2] mx-auto w-full max-w-3xl space-y-8 px-4 sm:px-6">
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
                    className={`${englishLetterBodyFont.variable} ${englishLetterOpeningFont.variable} ${koreanLetterFont.variable} relative mx-auto w-full max-w-2xl overflow-hidden rounded-[1.35rem] border px-5 pb-32 pt-[9rem] shadow-[0_24px_70px_rgba(8,10,20,0.34),inset_0_0_70px_rgba(130,91,35,0.06)] sm:px-10 sm:pb-36 sm:pt-[11rem] md:px-14`}
                    style={{
                      background: letterTheme.cardBackground,
                      borderColor: letterTheme.panelBorderColor,
                      color: letterTheme.textColor,
                    }}
                  >
                    <div
                      className="absolute inset-x-5 top-5 h-px sm:inset-x-9"
                      style={{ background: `linear-gradient(to right, transparent, ${letterTheme.dividerColor}, transparent)` }}
                    />
                    <LetterPostageStamp
                      photoUrl={petPhotoPreviewUrl && privacyConsent ? petPhotoPreviewUrl : null}
                      defaultStamp={resolveDefaultStampByPetType(petIntro.petType)}
                      accentColor={letterTheme.stampAccentColor}
                      inkColor={letterTheme.stampInkColor}
                    />
                    <aside
                      data-letter-margin-decoration
                      className="absolute bottom-10 left-3 top-[8.4rem] hidden w-8 flex-col items-center sm:flex md:left-5 md:w-10"
                      style={{ color: letterTheme.stampAccentColor }}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 28 30" className="h-7 w-7 shrink-0 opacity-75">
                        <g fill="currentColor" transform="translate(3 2) rotate(-8 11 13)">
                          <ellipse cx="11" cy="18" rx="7.5" ry="6.2" />
                          <ellipse cx="3" cy="10" rx="2.8" ry="4" transform="rotate(-22 3 10)" />
                          <ellipse cx="8.5" cy="5" rx="2.8" ry="4" transform="rotate(-7 8.5 5)" />
                          <ellipse cx="14.8" cy="4.8" rx="2.8" ry="4" transform="rotate(8 14.8 4.8)" />
                          <ellipse cx="20" cy="9.5" rx="2.8" ry="4" transform="rotate(23 20 9.5)" />
                        </g>
                      </svg>
                      <span
                        className="mt-3 w-px flex-1 opacity-65"
                        style={{ background: `linear-gradient(to bottom, ${letterTheme.stampAccentColor}, ${letterTheme.dividerColor}, transparent)` }}
                      />
                    </aside>
                    {isLoading && !bufferedReveal.visibleText.trim() ? (
                      <p className="mt-7 animate-pulse text-center text-base leading-8 opacity-75">
                        {t("result.letterStarting")}
                      </p>
                    ) : null}
                    <div
                      data-letter-body
                      className={`whitespace-pre-line text-left text-[17px] font-normal leading-[1.9] tracking-[0.012em] sm:pl-6 sm:leading-[1.95] md:pl-8 ${
                        letterLanguage === "ko" ? "break-keep sm:text-[19px]" : "sm:text-[20px]"
                      }`}
                      style={{
                        fontFamily: letterLanguage === "ko"
                          ? "var(--font-letter-ko), var(--font-noto-serif-kr), var(--font-nanum-myeongjo), serif"
                          : "var(--font-letter-en-body), 'Segoe Print', 'Bradley Hand', cursive",
                      }}
                    >
                      {letterOpening ? (
                        <span
                          data-letter-salutation
                          className={`mb-3 block break-words leading-[1.35] sm:mb-4 ${
                            letterLanguage === "ko" ? "text-[20px] sm:text-[22px]" : "text-[26px] sm:text-[31px]"
                          }`}
                          style={{
                            color: letterTheme.dropCapColor,
                            fontFamily: letterLanguage === "ko"
                              ? "var(--font-letter-ko), var(--font-noto-serif-kr), var(--font-nanum-myeongjo), serif"
                              : "var(--font-letter-en-opening), var(--font-letter-en-body), 'Segoe Script', cursive",
                            textShadow: "0 1px 1px rgba(83,55,24,0.12)",
                          }}
                        >
                          <InkWordReveal tokens={inkRevealPlan[0]} animate={animateLetterWords} live />
                        </span>
                      ) : null}
                      <InkWordReveal tokens={inkRevealPlan[1]} animate={animateLetterWords} live />
                    </div>
                    {!isLoading && (signatureDate || signatureName) ? (
                      <div
                        data-letter-signature
                        className="absolute bottom-8 right-5 max-w-[90%] text-right sm:bottom-10 sm:right-10 sm:max-w-[82%] md:right-14"
                        style={{ borderColor: letterTheme.dividerColor, color: letterTheme.endingColor }}
                      >
                        {signatureDate ? (
                          <p className={`text-xs font-normal tracking-[0.04em] opacity-75 sm:text-sm ${letterLanguage === "ko" ? "font-ko" : "font-display-en"}`}>
                            {signatureDate}
                          </p>
                        ) : null}
                        {signatureName ? (
                          <p
                            className="mt-2 text-[25px] leading-tight sm:text-[30px]"
                            style={{
                              fontFamily: letterLanguage === "ko"
                                ? "var(--font-letter-ko), var(--font-noto-serif-kr), var(--font-nanum-myeongjo), serif"
                                : "var(--font-letter-en-opening), var(--font-letter-en-body), 'Segoe Script', cursive",
                            }}
                          >
                            {signatureName}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </div>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={!canCaptureArtwork || isDownloading || isSharing}
                className={`flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-center text-sm font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-45 sm:text-base ${
                  lang === "ko" ? "font-ko tracking-normal" : "font-display-en"
                }`}
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <DownloadIcon />
                  <span>{isDownloading ? t("result.preparingImage") : t("result.keepForever")}</span>
                </span>
              </button>
              <div ref={shareTrayRef} className="relative flex min-w-0 flex-col gap-2 sm:block">
                <button
                  type="button"
                  onClick={() => setShareTrayOpen((open) => !open)}
                  disabled={!canCaptureArtwork || isSharing || isDownloading}
                  aria-expanded={shareTrayOpen}
                  aria-controls="letter-share-tray"
                  className={`flex min-h-[52px] w-full items-center justify-center rounded-xl border border-[#C7A43A]/75 bg-[#0C0B09] px-5 py-3 text-center text-sm font-medium text-[#D8B84C] transition hover:border-[#E0C15A] hover:bg-[#15120C] hover:text-[#E5C761] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] disabled:cursor-not-allowed disabled:opacity-45 sm:text-base ${
                    lang === "ko" ? "font-ko tracking-normal" : "font-display-en"
                  }`}
                >
                  <span className="inline-flex items-center justify-center gap-2.5">
                    <ShareIcon />
                    <span>{t("result.instagramShareButton")}</span>
                  </span>
                </button>

                <AnimatePresence>
                  {shareTrayOpen ? (
                    <motion.div
                      id="letter-share-tray"
                      role="group"
                      aria-label={t("result.shareOptions.label")}
                      initial={prefersReducedMotion ? false : { opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      exit={{ opacity: 0, scaleX: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.32,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="z-20 flex origin-left items-center justify-center gap-2 overflow-hidden rounded-xl border border-[#C7A43A]/55 bg-[#0C0B09] p-2 shadow-[0_14px_35px_rgba(0,0,0,0.45)] motion-reduce:transition-none sm:absolute sm:left-full sm:top-0 sm:ml-3 sm:min-h-[52px] sm:justify-start"
                    >
                      {([
                        {
                          label: t("result.shareOptions.instagram"),
                          icon: <FaInstagram aria-hidden="true" className="size-5" />,
                          className: "text-[#F06AA7] hover:bg-[#F06AA7]/15",
                          action: onInstagramButtonClick,
                        },
                        {
                          label: t("result.shareOptions.tiktok"),
                          icon: <FaTiktok aria-hidden="true" className="size-5" />,
                          className: "text-white drop-shadow-[1px_1px_0_#25F4EE] hover:bg-white/15",
                          action: () => openShareUrl(TIKTOK_WEBSITE_URL),
                        },
                        {
                          label: t("result.shareOptions.facebook"),
                          icon: <FaFacebookF aria-hidden="true" className="size-5" />,
                          className: "text-[#1877F2] hover:bg-[#1877F2]/15",
                          action: () => shareCurrentPage("facebook"),
                        },
                        {
                          label: t("result.shareOptions.x"),
                          icon: <FaXTwitter aria-hidden="true" className="size-5" />,
                          className: "text-white hover:bg-white/15",
                          action: () => shareCurrentPage("x"),
                        },
                        {
                          label: t("result.shareOptions.kakao"),
                          icon: <KakaoTalkMark />,
                          className: "!bg-transparent !text-[#191919] hover:bg-white/10",
                          action: () => openShareUrl(KAKAOTALK_WEBSITE_URL),
                        },
                        {
                          label: t("result.shareOptions.line"),
                          icon: <FaLine aria-hidden="true" className="size-6" />,
                          className: "text-[#06C755] hover:bg-[#06C755]/15",
                          action: () => shareCurrentPage("line"),
                        },
                        {
                          label: t("result.shareOptions.copyLink"),
                          icon: <HiOutlineLink aria-hidden="true" className="size-5" />,
                          className: "text-[#D8B84C] hover:bg-[#D8B84C]/15",
                          action: copyResultLink,
                        },
                      ] as ShareOption[]).map((option, index) => (
                        <motion.button
                          key={option.label}
                          type="button"
                          onClick={option.action}
                          disabled={option.disabled}
                          aria-label={option.label}
                          title={option.label}
                          initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -5 }}
                          transition={{
                            duration: prefersReducedMotion ? 0 : 0.18,
                            delay: prefersReducedMotion ? 0 : 0.1 + index * 0.04,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-white/[0.045] transition duration-150 hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:scale-100 motion-reduce:transform-none motion-reduce:transition-none ${option.className}`}
                        >
                          {option.icon}
                        </motion.button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            <section
              aria-label={t("result.productCards.label")}
              className={`mx-auto mt-6 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2 ${
                lang === "ko" ? "font-ko" : "font-display-en"
              }`}
            >
              <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#C7A43A]/40 bg-[#0C0B09] shadow-[0_16px_42px_rgba(0,0,0,0.28)]">
                <div className="relative aspect-[16/7] w-full overflow-hidden bg-black">
                  <Image
                    src="/images/letter-keepsake-result.png"
                    alt={t("result.productCards.keepsake.imageAlt")}
                    fill
                    sizes="(max-width: 640px) calc(100vw - 40px), 320px"
                    className="object-cover object-center"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-medium leading-snug text-[#F3E8D2]">
                    {t("result.productCards.keepsake.title")}
                  </h2>
                  <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-[#C4B8A8]">
                    {t("result.productCards.keepsake.description")}
                  </p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="mt-5 flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#C7A43A] px-4 py-3 text-center text-sm font-medium text-[#0B0A08]"
                  >
                    {t("result.productCards.keepsake.cta")}
                  </button>
                </div>
              </article>

              <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#C7A43A]/40 bg-[#0C0B09] shadow-[0_16px_42px_rgba(0,0,0,0.28)]">
                <div className="relative aspect-[16/7] w-full overflow-hidden bg-black">
                  <Image
                    src="/images/eternal-beam-result.png"
                    alt={t("result.productCards.eternalBeam.imageAlt")}
                    fill
                    sizes="(max-width: 640px) calc(100vw - 40px), 320px"
                    className="object-cover object-center"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-medium leading-snug text-[#F3E8D2]">
                    {t("result.productCards.eternalBeam.title")}
                  </h2>
                  <p className="mt-2 flex-1 text-sm font-light leading-relaxed text-[#C4B8A8]">
                    {t("result.productCards.eternalBeam.description")}
                  </p>
                  <a
                    href={officialSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#C7A43A]/75 bg-[#0A0908] px-4 py-3 text-center text-sm font-medium text-[#D8B84C] transition hover:border-[#E0C15A] hover:bg-[#17130D] hover:text-[#E5C761] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
                  >
                    {t("result.productCards.eternalBeam.cta")}
                  </a>
                </div>
              </article>
            </section>

            {!canCaptureArtwork ? (
              <p className="font-ko mt-4 text-center text-xs text-[#D4AF37]">
                {t("result.sceneLoading")}
              </p>
            ) : null}

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

            </div>

            <div id="kickstarter-promo" className="mx-auto mt-8 w-full max-w-4xl scroll-mt-4">
              <div className="relative aspect-[192/103] w-full overflow-hidden bg-black">
                <Image
                  src={lang === "ko" ? "/images/kickstarter-ko-v2.png" : "/images/kickstarter-v2.png"}
                  alt={lang === "ko" ? "Eternal Beam Kickstarter 출시 안내" : "Eternal Beam Kickstarter launch announcement"}
                  width={1536}
                  height={1024}
                  sizes="(max-width: 1024px) calc(100vw - 40px), 896px"
                  className="absolute inset-x-0 top-0 h-auto w-full"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_34px_18px_#000] sm:shadow-[inset_0_0_58px_24px_#000]"
                />

                {KICKSTARTER_URL ? (
                  <>
                    <a href={KICKSTARTER_URL} target="_blank" rel="noopener noreferrer" aria-label="Notify me on Kickstarter" className="absolute left-[61.8%] top-[60.6%] h-[10%] w-[34.3%] rounded-full transition duration-200 hover:scale-[1.015] hover:bg-white/[0.06] hover:shadow-[0_0_22px_rgba(0,255,178,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78] motion-reduce:transform-none motion-reduce:transition-none" />
                    <a href={KICKSTARTER_URL} target="_blank" rel="noopener noreferrer" aria-label="Visit Eternal Beam on Kickstarter" className="absolute left-[61.8%] top-[72.1%] h-[10%] w-[34.3%] rounded-full transition duration-200 hover:scale-[1.015] hover:bg-white/[0.06] hover:shadow-[0_0_22px_rgba(0,255,178,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78] motion-reduce:transform-none motion-reduce:transition-none" />
                  </>
                ) : (
                  <>
                    <button type="button" aria-label="Notify me on Kickstarter" className="absolute left-[61.8%] top-[60.6%] h-[10%] w-[34.3%] cursor-pointer rounded-full transition duration-200 hover:scale-[1.015] hover:bg-white/[0.06] hover:shadow-[0_0_22px_rgba(0,255,178,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78] motion-reduce:transform-none motion-reduce:transition-none" />
                    <button type="button" aria-label="Visit Eternal Beam on Kickstarter" className="absolute left-[61.8%] top-[72.1%] h-[10%] w-[34.3%] cursor-pointer rounded-full transition duration-200 hover:scale-[1.015] hover:bg-white/[0.06] hover:shadow-[0_0_22px_rgba(0,255,178,0.22)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78] motion-reduce:transform-none motion-reduce:transition-none" />
                  </>
                )}
              </div>

              <div className="mt-5 flex items-center justify-center gap-3 text-[#D8B84C]" aria-hidden="true">
                <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
                <span className="font-display-en text-xs tracking-[0.2em] sm:text-sm">Follow our journey</span>
                <span className="h-px w-12 bg-[#D8B84C]/65 sm:w-20" />
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <a href={instagramProfileUrl} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on Instagram" className="flex size-11 items-center justify-center rounded-xl bg-[radial-gradient(circle_at_32%_100%,#FFD600_0%,#FF7A00_24%,#FF0169_48%,#D300C5_70%,#7638FA_100%)] text-white shadow-[0_5px_16px_rgba(211,0,197,0.24)] transition duration-200 hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F06AA7] motion-reduce:transform-none"><FaInstagram aria-hidden="true" className="size-7" /></a>
                <a href="https://www.facebook.com/eternalbeam.official/" target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on Facebook" className="flex size-11 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-[0_5px_16px_rgba(24,119,242,0.22)] transition duration-200 hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA] motion-reduce:transform-none"><FaFacebookF aria-hidden="true" className="size-6" /></a>
                {ETERNAL_BEAM_YOUTUBE_URL ? <a href={ETERNAL_BEAM_YOUTUBE_URL} target="_blank" rel="noopener noreferrer" aria-label="Follow Eternal Beam on YouTube" className="flex size-11 items-center justify-center rounded-xl bg-[#FF0000] text-white shadow-[0_5px_16px_rgba(255,0,0,0.22)] transition duration-200 hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3B30] motion-reduce:transform-none"><FaYoutube aria-hidden="true" className="size-7" /></a> : <button type="button" aria-label="Follow Eternal Beam on YouTube" className="flex size-11 cursor-pointer items-center justify-center rounded-xl bg-[#FF0000] text-white shadow-[0_5px_16px_rgba(255,0,0,0.22)] transition duration-200 hover:scale-105 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF3B30] motion-reduce:transform-none"><FaYoutube aria-hidden="true" className="size-7" /></button>}
              </div>
              <p className="mt-2 text-center text-[10px] font-light tracking-[0.12em] text-[#B6A88F] sm:text-xs">
                © 2026 Eternal Beam. All rights reserved.
              </p>
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
        data-questionnaire-pet-theme={questionnairePetTheme.key}
        className={`relative isolate z-[1] flex min-h-screen flex-col ${
          showChannelBackground ? "bg-transparent" : "bg-black"
        }`}
      >
        {questionnairePetTheme.background ? (
          <div
            data-questionnaire-pet-background
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            aria-hidden="true"
          >
            <Image
              src={questionnairePetTheme.background}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-[18%_top] opacity-80 brightness-[0.9] sm:object-[24%_top] sm:opacity-70 sm:brightness-[0.85] lg:object-center"
            />
            <div className="absolute inset-0 bg-black/40 sm:bg-black/45 lg:bg-black/50" />
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.26)_58%,rgba(0,0,0,0.62)_100%)] lg:bg-[linear-gradient(to_bottom,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.34)_58%,rgba(0,0,0,0.72)_100%)]" />
          </div>
        ) : null}
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
            <div className="mb-6 flex items-center justify-between gap-4 text-xs text-[#D4AF37]">
              <span className="font-display-en uppercase">
                {t("questionHeader.label")} {questionIndex + 1} {t("questionHeader.of")} {totalQuestionCount}
              </span>
              <span className={lang === "ko" ? "font-ko" : "font-display-en"}>
                {lang === "ko"
                  ? `질문 ${questionsLeft}개 남음`
                  : <>{questionsLeft} {t("questionHeader.left")}</>}
              </span>
            </div>
            <div className="mb-8 h-px overflow-hidden rounded-full bg-[rgba(243,234,216,0.12)]">
              <div
                className="h-full rounded-full bg-[#D4AF37] transition-all duration-700 ease-out"
                style={{ width: `${((questionIndex + 1) / totalQuestionCount) * 100}%` }}
              />
            </div>

            {isIntroQuestion ? <div key={questionIndex} className="animate-fade-in mb-8 space-y-6">
              <PetIntroForm
                mode={mode}
                questionId={introQuestionId}
                profile={petIntro}
                onChange={patchPetIntro}
                showErrors={showValidationErrors}
              />
            </div> : null}

            {isSurveyQuestion ? <div key={step} className="animate-fade-in">
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
                onMemoryChange={handleMemoryChange}
                onToneMood={handleToneMood}
                onToneLength={handleToneLength}
                onSkipOptional={handleSkipOptional}
                showValidationError={showValidationErrors && !isAnswerValid}
              />
            </div> : null}

            {isEmailQuestion ? (
              <div className={`animate-fade-in space-y-5 ${lang === "ko" ? "font-ko" : "font-display-en"}`}>
                <div className="space-y-2">
                  <p className="step-kicker">{t("form.emailStep.kicker")}</p>
                </div>
                <div className="space-y-2">
                  <input
                    id="questionnaire-email"
                    type="email"
                    aria-label={t("form.emailStep.label")}
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onBlur={() => setEmail((current) => normalizeQuestionnaireEmail(current))}
                    placeholder={t("form.emailStep.placeholder")}
                    aria-invalid={showValidationErrors && !isValidQuestionnaireEmail(email)}
                    aria-describedby={showValidationErrors && !isValidQuestionnaireEmail(email) ? "questionnaire-email-error" : undefined}
                    className={`w-full rounded-xl border-[0.5px] bg-transparent px-4 py-3 text-base font-extralight text-white outline-none transition placeholder:text-[#EDE4D3]/50 md:text-sm ${
                      showValidationErrors && !isValidQuestionnaireEmail(email)
                        ? "border-red-300/75 focus:border-red-300"
                        : "border-[rgba(212,175,55,0.35)] focus:border-[#D4AF37]"
                    }`}
                  />
                  {showValidationErrors && !isValidQuestionnaireEmail(email) ? (
                    <p id="questionnaire-email-error" className="text-xs font-extralight leading-relaxed text-red-200" role="alert">
                      {t("form.emailStep.validation")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={goPrev}
                disabled={questionIndex === 0}
                className="font-ko min-h-[44px] rounded-xl border-[0.5px] border-[rgba(212,175,55,0.45)] bg-transparent px-4 py-3 text-sm font-light text-[#FFFFFF] transition hover:bg-[rgba(212,175,55,0.06)] active:bg-[rgba(212,175,55,0.1)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {t("buttons.prev")}
              </button>
              {isLastQuestion ? (
                <button
                  type="button"
                  onClick={submitAnswers}
                  disabled={isLoading}
                  className="font-ko min-h-[44px] rounded-xl bg-[#b89a2e] px-4 py-3 text-sm font-light text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-[#a88928] active:bg-[#9a7f24] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? t("buttons.generating") : t("buttons.generate")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void goNext()}
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
          {privacyModalOpen ? (
            <QuestionnairePrivacyNotice
              selections={privacySelections}
              onSelectionChange={changePrivacySelection}
              onAgreeAll={agreeToAllPrivacy}
              onBack={closePrivacyNotice}
              onConfirm={confirmPrivacyNotice}
            />
          ) : null}
          {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
        </section>
        </div>
      </main>
      )}
    </>
  );
}
