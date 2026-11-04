"use client";

/* eslint-disable @next/next/no-img-element -- Phase 2 previews use local blob URLs and stay client-side. */

import { LanguageToggle } from "@/components/language-toggle";
import { storyTabProps } from "@/components/pet-first-home";
import { BrandMark } from "@/components/storybook/brand-mark";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { petFirstCopy } from "@/lib/pet-first-archive";
import { LetterDownloadGate } from "@/components/letter-download-gate";
import { useLocale } from "@/components/locale-provider";
import { useAuthSession } from "@/components/use-auth-session";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { requestLetterDownloadCode, verifyLetterDownloadCode } from "@/lib/letter-download-auth";
import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import {
  optionById,
  optionsForStatus,
  whisperFor,
  type PolaroidSpecies,
  type PolaroidStatus,
  type SeasonalOption,
} from "@/lib/seasonal-polaroid";
import {
  everydayPolaroidArtStyles,
  isEverydayPolaroidArtStyle,
  isPolaroidOccasionAdmitted,
  polaroidOccasionItem,
  polaroidThemeCatalogEntry,
  polaroidThemeTitle,
  POLAROID_OCCASION_GROUPS,
  type PolaroidThemeCatalogEntry,
} from "@/lib/polaroid-theme-catalog";
import { polaroidThemeById } from "@/lib/polaroid-themes";
import {
  SEASONAL_POLAROID_PHOTO_ACCEPT,
  validateSeasonalPolaroidPhoto,
  type SeasonalPolaroidPhotoError,
} from "@/lib/seasonal-polaroid-photo";
import type { Locale } from "@/lib/i18n";
import {
  admitSeasonalPolaroid,
  buildSeasonalPolaroidFormData,
  clearSeasonalPolaroidSession,
  fetchSeasonalPolaroidImage,
  readSeasonalPolaroidTrial,
  readSeasonalPolaroidSession,
  readSeasonalPolaroidStatus,
  saveSeasonalPolaroidSession,
  SeasonalPolaroidRequestError,
  type SeasonalPolaroidGenerationSession,
  type SeasonalPolaroidPreviewResult,
} from "@/lib/seasonal-polaroid-client";
import type { SeasonalPolaroidQuestionnaire, SeasonalPolaroidResult } from "@/lib/seasonal-polaroid-contract";
import { clearPendingResultSave, readPendingResultSave, writePendingResultSave } from "@/lib/pending-result-save";
import { SEASONAL_POLAROID_FRAME_BASE_CLASS, SeasonalPolaroidFrame } from "@/components/seasonal-polaroid-frame";
import { exportSeasonalPolaroidPng } from "@/lib/seasonal-polaroid-export";
import { LuRefreshCw } from "react-icons/lu";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";

type Step = 1 | 2 | 3 | 4;
type WhisperTrigger =
  | { kind: "default" | "photo" | "habit" | "treat" | "callName" }
  | { kind: "costume" | "scene" | "vibe" | "personality"; id: string };

type PolaroidAnswers = {
  themeId: string;
  occasionId: string;
  petName: string;
  species: PolaroidSpecies | "";
  status: PolaroidStatus | "";
  costume: string;
  scene: string;
  vibe: string;
  personalities: string[];
  habit: string;
  customHabit: string;
  favoriteTreat: string;
  customTreat: string;
  callName: string;
  customCallName: string;
  personalDetail: string;
};

type LocalPhoto = {
  id: string;
  file: File;
  url: string;
};

type GenerationView = "questionnaire" | "developing" | "result";

// UI-only estimates matching the Supabase Email OTP configuration. Supabase
// remains authoritative for whether a code is actually valid.
const OTP_VALIDITY_MS = 300_000;
const OTP_RESEND_COOLDOWN_MS = 30_000;

type PolaroidEntryProps = {
  /** Server-derived flag. It intentionally defaults to false. */
  generationEnabled?: boolean;
  yearRoundEnabled?: boolean;
  christmasEnabled?: boolean;
  artAllEnabled?: boolean;
  initialPetId?: string | null;
};

const DRAFT_STORAGE_KEY = "soul-trace-seasonal-polaroid-draft";
const EMPTY_ANSWERS: PolaroidAnswers = {
  themeId: "",
  occasionId: "",
  petName: "",
  species: "",
  status: "",
  costume: "",
  scene: "",
  vibe: "",
  personalities: [],
  habit: "",
  customHabit: "",
  favoriteTreat: "",
  customTreat: "",
  callName: "",
  customCallName: "",
  personalDetail: "",
};

const STEP_IDS = ["meet", "scene", "personality", "preview"] as const;
const SPECIES_OPTIONS: readonly SeasonalOption[] = [
  { id: "dog", emoji: "🐶", labelKey: "options.species.dog" },
  { id: "cat", emoji: "🐱", labelKey: "options.species.cat" },
  { id: "rabbit", emoji: "🐰", labelKey: "options.species.rabbit" },
  { id: "hamster", emoji: "🐹", labelKey: "options.species.hamster" },
  { id: "bird", emoji: "🐦", labelKey: "options.species.bird" },
  { id: "other", emoji: "🐾", labelKey: "options.species.other" },
];

const CUSTOM_HABIT_OPTION: SeasonalOption = {
  id: "custom",
  emoji: "✦",
  labelKey: "options.habits.custom",
};

function fieldClass(lang: Locale, invalid = false) {
  return `w-full rounded-xl border bg-[#fffaf0] px-4 py-3.5 text-base font-extralight text-[#393129] outline-none transition placeholder:text-[#857666] focus:border-[#9e774c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9e774c] ${
    invalid ? "border-red-300/80" : "border-[#dfceb6]"
  } ${lang === "ko" ? "font-ko" : "font-display-en !tracking-normal"}`;
}

function optionPath(option: SeasonalOption) {
  return `seasonalPolaroid.flow.${option.labelKey}`;
}

function koreanSubject(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "아이";
  const last = trimmed[trimmed.length - 1];
  const code = last.charCodeAt(0);
  const hasFinalConsonant = code >= 0xac00 && code <= 0xd7a3
    ? (code - 0xac00) % 28 !== 0
    : false;
  return `${trimmed}${hasFinalConsonant ? "이" : "가"}`;
}

function sceneDefaults(themeId: string, status: PolaroidStatus | "") {
  const theme = polaroidThemeById(themeId) ?? polaroidThemeById("halloween")!;
  const typedStatus = status || "living";
  return {
    costume: optionsForStatus(theme.costumes, typedStatus)[0]?.id ?? "",
    scene: optionsForStatus(theme.scenes, typedStatus)[0]?.id ?? "",
    vibe: optionsForStatus(theme.vibes, typedStatus)[0]?.id ?? "",
  };
}

function interpolateWhisper(text: string, name: string, lang: Locale): string {
  return text
    .replaceAll("%NAME%", name.trim())
    .replaceAll("%NAME_SUBJECT%", lang === "ko" ? koreanSubject(name) : name.trim());
}

function restoreDraft(value: unknown): Partial<PolaroidAnswers> {
  if (!value || typeof value !== "object") return {};
  const draft = value as Partial<PolaroidAnswers>;
  const restored: Partial<PolaroidAnswers> = {
    themeId: typeof draft.themeId === "string" && (isEverydayPolaroidArtStyle(draft.themeId) || draft.themeId === "halloween") && polaroidThemeById(draft.themeId) ? draft.themeId : "",
    occasionId: typeof draft.occasionId === "string" && polaroidOccasionItem(draft.occasionId) ? draft.occasionId : "",
    petName: typeof draft.petName === "string" ? draft.petName.slice(0, 12) : "",
    species: ["dog", "cat", "rabbit", "hamster", "bird", "other"].includes(String(draft.species))
      ? draft.species as PolaroidSpecies
      : "",
    status: draft.status === "living" || draft.status === "passed" ? draft.status : "",
    costume: typeof draft.costume === "string" ? draft.costume : "",
    scene: typeof draft.scene === "string" ? draft.scene : "",
    vibe: typeof draft.vibe === "string" ? draft.vibe : "",
    personalities: Array.isArray(draft.personalities)
      ? draft.personalities.filter((item): item is string => typeof item === "string").slice(0, 2)
      : [],
    habit: typeof draft.habit === "string" ? draft.habit : "",
    customHabit: typeof draft.customHabit === "string" ? draft.customHabit.slice(0, 60) : "",
    favoriteTreat: typeof draft.favoriteTreat === "string" ? draft.favoriteTreat : "",
    customTreat: typeof draft.customTreat === "string" ? draft.customTreat.slice(0, 60) : "",
    // "Something else" was retired; a draft that still carries it means "A name" with the same typed name.
    callName: typeof draft.callName === "string" ? (draft.callName === "custom" ? "by-name" : draft.callName) : "",
    customCallName: typeof draft.customCallName === "string" ? draft.customCallName.slice(0, 40) : "",
    personalDetail: typeof draft.personalDetail === "string" ? draft.personalDetail.slice(0, 60) : "",
  };

  const restoredTheme = polaroidThemeById(restored.occasionId || restored.themeId || "halloween") ?? polaroidThemeById("halloween")!;
  if (restored.status) {
    if (restored.costume && !optionsForStatus(restoredTheme.costumes, restored.status).some((item) => item.id === restored.costume)) restored.costume = "";
    if (restored.scene && !optionsForStatus(restoredTheme.scenes, restored.status).some((item) => item.id === restored.scene)) restored.scene = "";
    if (restored.vibe && !optionsForStatus(restoredTheme.vibes, restored.status).some((item) => item.id === restored.vibe)) restored.vibe = "";
  }
  if (restored.species) {
    const habits = restoredTheme.habitsBySpecies[restored.species];
    const treats = restoredTheme.treatsBySpecies[restored.species];
    if (restored.habit && restored.habit !== "custom" && !habits.some((item) => item.id === restored.habit)) restored.habit = "";
    if (restored.habit !== "custom") restored.customHabit = "";
    if (restored.favoriteTreat && !treats.some((item) => item.id === restored.favoriteTreat)) {
      restored.favoriteTreat = "";
      restored.customTreat = "";
    }
  }
  if (restored.callName && !restoredTheme.callNames.some((item) => item.id === restored.callName)) {
    restored.callName = "";
    restored.customCallName = "";
  } else if (restored.callName !== "by-name") {
    restored.customCallName = "";
  }
  return restored;
}

function photoErrorMessage(error: SeasonalPolaroidPhotoError, t: (path: string) => string): string {
  if (error === "size") return t("seasonalPolaroid.flow.photoSize");
  if (error === "empty") return t("seasonalPolaroid.flow.photoEmpty");
  return t("seasonalPolaroid.flow.photoType");
}

function formatRetryWait(seconds: number | null, lang: Locale): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds < 1) return null;
  if (seconds >= 86_400) {
    const days = Math.ceil(seconds / 86_400);
    return lang === "ko" ? `약 ${days}일` : `about ${days} day${days === 1 ? "" : "s"}`;
  }
  if (seconds >= 3_600) {
    const hours = Math.ceil(seconds / 3_600);
    return lang === "ko" ? `약 ${hours}시간` : `about ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return lang === "ko" ? `약 ${minutes}분` : `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return lang === "ko" ? `약 ${Math.ceil(seconds)}초` : `about ${Math.ceil(seconds)} second${seconds === 1 ? "" : "s"}`;
}

function seasonalRequestErrorMessage(error: unknown, lang: Locale, t: (path: string) => string): string {
  if (!(error instanceof SeasonalPolaroidRequestError)) {
    return error instanceof Error ? error.message : t("seasonalPolaroid.generation.requestError");
  }
  const wait = formatRetryWait(error.retryAfter, lang);
  if (error.code === "rate_limited") {
    return t("seasonalPolaroid.generation.rateLimited").replaceAll("%TIME%", wait ?? t("seasonalPolaroid.generation.tryLater"));
  }
  if (error.code === "busy") {
    return t("seasonalPolaroid.generation.busy").replaceAll("%TIME%", wait ?? t("seasonalPolaroid.generation.tryLater"));
  }
  if (error.code === "guest_trial_exhausted") {
    return t("seasonalPolaroid.generation.freeComplete");
  }
  return error.message || t("seasonalPolaroid.generation.requestError");
}

function ChoiceButton({
  option,
  label,
  selected,
  onClick,
  bodyFont,
  multi = false,
}: {
  option: SeasonalOption;
  label: string;
  selected: boolean;
  onClick: () => void;
  bodyFont: string;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex h-full min-w-0 w-full min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-light transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] ${bodyFont} ${
        selected
          ? "border-[#9e774c] bg-[#9e774c] text-[#fffaf2]"
          : "border-[#eadcc6] bg-[#fff8ec] text-[#393129] hover:border-[#9e774c]/60 hover:bg-[#f1e5cf]"
      }`}
    >
      <span className="shrink-0 text-xl leading-none" aria-hidden="true">{option.emoji}</span>
      <span className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere]">{label}</span>
      {multi ? <span className={`shrink-0 text-xs ${selected ? "text-[#F0CF71]" : "text-[#8F8578]"}`} aria-hidden="true">{selected ? "✓" : "＋"}</span> : null}
    </button>
  );
}

export function PolaroidEntry({
  generationEnabled = false,
  yearRoundEnabled = false,
  christmasEnabled = false,
  artAllEnabled = false,
  initialPetId = null,
}: PolaroidEntryProps) {
  const { lang, t: translate } = useLocale();
  // Seasonal generation copy lives under the flow namespace in both locale
  // files. Normalize legacy call sites in this component so a missing path can
  // never render the literal `seasonalPolaroid.generation.*` key.
  const t = useCallback((path: string) => translate(path.replace(
    "seasonalPolaroid.generation.",
    "seasonalPolaroid.flow.generation.",
  )), [translate]);
  const authSession = useAuthSession();
  const bodyFont = lang === "ko" ? "font-ko break-keep font-normal tracking-normal" : "font-display-en";
  const themeFlags = useMemo(() => ({
    yearRound: yearRoundEnabled,
    christmas: christmasEnabled,
    artAll: artAllEnabled,
  }), [artAllEnabled, christmasEnabled, yearRoundEnabled]);
  const [savedPets, setSavedPets] = useState<Array<{ petId: string; petName: string; species: string | null; lifeStatus: string }>>([]);
  const artThemes = useMemo(
    () => everydayPolaroidArtStyles(themeFlags),
    [themeFlags],
  );
  const [step, setStep] = useState<Step>(1);
  const [answers, setAnswers] = useState<PolaroidAnswers>(() => ({
    ...EMPTY_ANSWERS,
    themeId: yearRoundEnabled ? "" : "halloween",
    ...(!yearRoundEnabled ? sceneDefaults("halloween", "") : {}),
  }));
  const theme = polaroidThemeById(answers.themeId) ?? polaroidThemeById("halloween")!;
  const optionTheme = polaroidThemeById(answers.occasionId) ?? theme;
  const selectedTheme = polaroidThemeCatalogEntry(answers.themeId);
  const selectedOccasion = polaroidOccasionItem(answers.occasionId);
  const occasionReady = !answers.occasionId || isPolaroidOccasionAdmitted(answers.occasionId, themeFlags);
  const [primaryPhoto, setPrimaryPhoto] = useState<LocalPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<GenerationView>("questionnaire");
  const [generationSession, setGenerationSession] = useState<SeasonalPolaroidGenerationSession | null>(null);
  const [generationStatus, setGenerationStatus] = useState<"queued" | "processing" | null>(null);
  const [generationResult, setGenerationResult] = useState<(SeasonalPolaroidResult | SeasonalPolaroidPreviewResult) | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [mockMode, setMockMode] = useState(false);
  const [trialRemaining, setTrialRemaining] = useState<number>(2);
  const [developerTesting, setDeveloperTesting] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [generationEmail, setGenerationEmail] = useState("");
  const [generationCode, setGenerationCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailStep, setEmailStep] = useState<"email" | "code">("email");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "verifying">("idle");
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [, setResendTick] = useState(0);
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [, setCodeTick] = useState(0);
  const [saveGateOpen, setSaveGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "download" | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [whisperTrigger, setWhisperTrigger] = useState<WhisperTrigger>({ kind: "default" });
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<LocalPhoto | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const polaroidRef = useRef<HTMLDivElement>(null);
  const saveLock = useRef(false);
  const emailRequestPending = useRef(false);

  const releaseImagePreview = () => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }
    setImageUrl(null);
  };

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        setAnswers((current) => ({ ...current, ...restoreDraft(JSON.parse(saved)) }));
      }
    } catch {
      // A blocked or malformed draft is safely ignored.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    photoRef.current = primaryPhoto;
  }, [primaryPhoto]);

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // Draft restoration is an enhancement; private browsing may disable it.
    }
  }, [answers, hydrated]);

  useEffect(() => {
    if (!hydrated || !generationEnabled) return;
    const saved = readSeasonalPolaroidSession();
    if (!saved) return;
    setGenerationSession(saved);
    if (saved.pendingAction) setPendingAction(saved.pendingAction);
    const pending = readPendingResultSave();
    if (pending?.kind === "seasonal-polaroid" && pending.jobId === saved.jobId) setPendingAction(pending.action);
    setView("developing");
    setGenerationStatus("queued");
  }, [generationEnabled, hydrated]);

  useEffect(() => {
    if (Date.now() >= resendAvailableAt) return;
    const timer = window.setInterval(() => {
      setResendTick((value) => value + 1);
      if (Date.now() >= resendAvailableAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  useEffect(() => {
    if (emailStep !== "code" || codeExpiresAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      setCodeTick((value) => value + 1);
      if (Date.now() >= codeExpiresAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [codeExpiresAt, emailStep]);

  useEffect(() => {
    if (!hydrated || authSession.status !== "authenticated") return;
    const controller = new AbortController();
    void fetch("/api/my/pets", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body || !Array.isArray(body.pets)) return;
        setSavedPets(body.pets.map((pet: { petId: string; petName: string; species?: string | null; lifeStatus?: string }) => ({
          petId: pet.petId,
          petName: pet.petName,
          species: pet.species ?? null,
          lifeStatus: pet.lifeStatus ?? "unspecified",
        })));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [authSession.status, hydrated]);

  useEffect(() => {
    if (!initialPetId || !savedPets.length) return;
    const pet = savedPets.find((item) => item.petId === initialPetId);
    if (pet) applySavedPet(pet);
  }, [initialPetId, savedPets]);

  useEffect(() => {
    if (!hydrated || !generationEnabled) return;
    const controller = new AbortController();
    void readSeasonalPolaroidTrial(controller.signal)
      .then((trial) => {
        setDeveloperTesting(trial.developer === true);
        if (trial.remaining !== null) setTrialRemaining(trial.remaining);
      })
      .catch(() => {
        // The admission response remains authoritative when the optional
        // display read is unavailable.
      });
    return () => controller.abort();
  }, [generationEnabled, hydrated]);

  useEffect(() => {
    if (view !== "developing" || !generationSession || mockMode) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const response = await readSeasonalPolaroidStatus(generationSession, controller.signal);
        if (cancelled) return;
        if (response.status === "failed") {
          clearSeasonalPolaroidSession();
          setGenerationSession(null);
          setGenerationStatus(null);
          // The API deliberately returns a generic, non-localized failure
          // body. Keep the user-facing terminal state in the active locale.
          setGenerationError(t("seasonalPolaroid.flow.generation.failed"));
          setView("result");
          void readSeasonalPolaroidTrial().then((trial) => {
            setDeveloperTesting(trial.developer === true);
            if (trial.remaining !== null) setTrialRemaining(trial.remaining);
          }).catch(() => undefined);
          return;
        }
        if (response.status === "succeeded") {
          setGenerationStatus(null);
          setGenerationResult(response.result);
          setGenerationError(null);
          const accessToken = response.result.image.accessToken;
          if (!accessToken) {
            setGenerationError(t("seasonalPolaroid.generation.imageUnavailable"));
            setView("result");
            return;
          }
          setImageLoading(true);
          try {
            const objectUrl = await fetchSeasonalPolaroidImage(generationSession, accessToken, controller.signal);
            if (!cancelled) {
              if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
              imageUrlRef.current = objectUrl;
              setImageUrl(objectUrl);
              setImageLoading(false);
              setView("result");
            } else {
              URL.revokeObjectURL(objectUrl);
            }
          } catch {
            // A status request mints a fresh short-lived image token. Retry once
            // through the status endpoint instead of exposing a private URL.
            try {
              const refreshed = await readSeasonalPolaroidStatus(generationSession, controller.signal);
              const freshToken = refreshed.status === "succeeded" ? refreshed.result.image.accessToken : undefined;
              if (!freshToken) throw new Error("image token unavailable");
              const objectUrl = await fetchSeasonalPolaroidImage(generationSession, freshToken, controller.signal);
              if (!cancelled) {
                if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
                imageUrlRef.current = objectUrl;
                setImageUrl(objectUrl);
                setImageLoading(false);
                setView("result");
              } else {
                URL.revokeObjectURL(objectUrl);
              }
            } catch {
              if (!cancelled) {
                setGenerationError(t("seasonalPolaroid.generation.imageUnavailable"));
                setImageLoading(false);
                setView("result");
              }
            }
          } finally {
            if (!cancelled) setImageLoading(false);
          }
          return;
        }
        if (response.status === "queued" || response.status === "processing") setGenerationStatus(response.status);
        timer = setTimeout(poll, response.status === "processing" ? 2500 : 1800);
      } catch (pollError) {
        if (cancelled || (pollError instanceof DOMException && pollError.name === "AbortError")) return;
        setGenerationError(t("seasonalPolaroid.generation.pollingError"));
        timer = setTimeout(poll, 5000);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [generationSession, mockMode, t, view]);

  useEffect(() => {
    if (view !== "developing" || mockMode) return;
    const timer = window.setInterval(() => setLoadingMessageIndex((index) => index + 1), 4200);
    return () => window.clearInterval(timer);
  }, [mockMode, view]);

  useEffect(() => () => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, []);

  const label = (option: SeasonalOption) => t(optionPath(option));
  const status = answers.status;
  const availableHabits = answers.species ? theme.habitsBySpecies[answers.species] : [];
  const availableTreats = answers.species ? theme.treatsBySpecies[answers.species] : [];
  const habitOptions = [...availableHabits, CUSTOM_HABIT_OPTION];

  const whisperRule = useMemo(() => {
    if (!status) return theme.whispers.default;
    if (whisperTrigger.kind === "default") return theme.whispers.default;
    if (whisperTrigger.kind === "photo") return theme.whispers.photo;
    if (whisperTrigger.kind === "habit") return theme.whispers.habit;
    if (whisperTrigger.kind === "treat") return theme.whispers.treat;
    if (whisperTrigger.kind === "callName") return theme.whispers.callName;
    if (!("id" in whisperTrigger)) return theme.whispers.default;
    const list = theme.whispers[whisperTrigger.kind];
    return whisperFor(list, whisperTrigger.id, status) ?? theme.whispers.default;
  }, [status, theme.whispers, whisperTrigger]);

  const whisperPath = whisperTrigger.kind === "default" && status === "passed"
    ? "seasonalPolaroid.flow.whispers.defaultPassed"
    : whisperTrigger.kind === "default"
      ? "seasonalPolaroid.flow.whispers.defaultLiving"
      : `seasonalPolaroid.flow.${whisperRule.key}`;
  const whisperText = interpolateWhisper(t(whisperPath), answers.petName, lang);

  const selectedChips = [
    answers.costume ? optionById(optionTheme.costumes, answers.costume) : undefined,
    answers.scene ? optionById(optionTheme.scenes, answers.scene) : undefined,
    answers.vibe ? optionById(optionTheme.vibes, answers.vibe) : undefined,
    ...answers.personalities.map((id) => optionById(theme.personalities, id)),
    answers.habit && answers.habit !== "custom"
      ? optionById(availableHabits, answers.habit)
      : answers.customHabit
        ? CUSTOM_HABIT_OPTION
        : undefined,
    answers.favoriteTreat && answers.favoriteTreat !== "custom"
      ? optionById(availableTreats, answers.favoriteTreat)
      : answers.customTreat
        ? { id: "custom-treat", emoji: "✍️", labelKey: "options.treats.custom" }
        : undefined,
    answers.callName && answers.callName !== "by-name"
      ? optionById(theme.callNames, answers.callName)
      : answers.customCallName
        ? { id: "custom-call", emoji: "✍️", labelKey: "options.callNames.byName" }
        : undefined,
  ].filter((item): item is SeasonalOption => Boolean(item));

  const updateAnswers = (patch: Partial<PolaroidAnswers>, nextWhisper?: WhisperTrigger) => {
    setAnswers((current) => ({ ...current, ...patch }));
    setError(null);
    setNotice(null);
    if (nextWhisper) setWhisperTrigger(nextWhisper);
  };

  const updateStatus = (nextStatus: PolaroidStatus) => {
    setAnswers((current) => {
      const nextOption = polaroidThemeById(current.occasionId) ?? polaroidThemeById(current.themeId) ?? polaroidThemeById("halloween")!;
      return {
        ...current,
        status: nextStatus,
        ...sceneDefaults(nextOption.id, nextStatus),
      };
    });
    setError(null);
    setWhisperTrigger({ kind: "default" });
  };

  const updateTheme = (nextThemeId: string) => {
    const nextTheme = polaroidThemeById(nextThemeId);
    if (!nextTheme) return;
    setAnswers((current) => {
      const optionId = polaroidThemeById(current.occasionId) ? current.occasionId : nextThemeId;
      return {
        ...current,
        themeId: nextThemeId,
        ...sceneDefaults(optionId, current.status),
      };
    });
    setError(null);
    setWhisperTrigger({ kind: "default" });
  };

  const updateOccasion = (nextOccasionId: string) => {
    setAnswers((current) => {
      const cleared = current.occasionId === nextOccasionId;
      const occasionId = cleared ? "" : nextOccasionId;
      const optionId = polaroidThemeById(occasionId)?.id || current.themeId || "halloween";
      return {
        ...current,
        occasionId,
        ...sceneDefaults(optionId, current.status),
      };
    });
    setError(null);
    setWhisperTrigger({ kind: "default" });
  };

  const applySavedPet = (pet: { petName: string; species: string | null; lifeStatus: string }) => {
    const speciesId = SPECIES_OPTIONS.find((item) => item.id === pet.species)?.id as PolaroidSpecies | undefined;
    updateAnswers({
      petName: pet.petName.slice(0, 12),
      ...(speciesId ? { species: speciesId } : {}),
    }, { kind: "default" });
    void pet.lifeStatus;
  };

  const updateSpecies = (nextSpecies: PolaroidSpecies) => {
    const nextHabits = theme.habitsBySpecies[nextSpecies];
    const nextTreats = theme.treatsBySpecies[nextSpecies];
    setAnswers((current) => ({
      ...current,
      species: nextSpecies,
      habit: current.habit === "custom" || nextHabits.some((item) => item.id === current.habit) ? current.habit : "",
      customHabit: current.habit === "custom" ? current.customHabit : "",
      favoriteTreat: nextTreats.some((item) => item.id === current.favoriteTreat) ? current.favoriteTreat : "",
      customTreat: current.favoriteTreat === "custom" && nextTreats.some((item) => item.id === "custom") ? current.customTreat : "",
    }));
    setError(null);
  };

  // One photo only: the generation pipeline uses a single reference photo.
  const setPhoto = (file: File) => {
    const validation = validateSeasonalPolaroidPhoto(file);
    if (validation) {
      setPhotoError(photoErrorMessage(validation, t));
      return;
    }
    const photo = { id: `primary-${Date.now()}-${Math.random().toString(16).slice(2)}`, file, url: URL.createObjectURL(file) };
    if (primaryPhoto) URL.revokeObjectURL(primaryPhoto.url);
    setPrimaryPhoto(photo);
    setPhotoError(null);
    setError(null);
    setWhisperTrigger({ kind: "photo" });
  };

  const removePhoto = () => {
    if (primaryPhoto) URL.revokeObjectURL(primaryPhoto.url);
    setPrimaryPhoto(null);
    setPhotoError(null);
    setWhisperTrigger({ kind: "default" });
  };

  const openPhotoPicker = () => {
    primaryInputRef.current?.click();
  };

  const onPhotoInput = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (file) setPhoto(file);
    if (primaryInputRef.current) primaryInputRef.current.value = "";
  };

  const validateStep = (currentStep: Step): string | null => {
    if (currentStep === 1) {
      if (!answers.petName.trim()) return t("seasonalPolaroid.flow.validation.name");
      if (answers.petName.trim().length > 12) return t("seasonalPolaroid.flow.validation.nameLength");
      if (!answers.species) return t("seasonalPolaroid.flow.validation.species");
      if (!answers.status) return t("seasonalPolaroid.flow.validation.status");
      if (!primaryPhoto) return t("seasonalPolaroid.flow.validation.photo");
    }
    if (currentStep === 2) {
      if (!answers.themeId || !polaroidThemeById(answers.themeId)) return t("seasonalPolaroid.flow.yearRound.themeRequired");
      if (yearRoundEnabled && !isEverydayPolaroidArtStyle(answers.themeId)) return t("seasonalPolaroid.flow.yearRound.themeRequired");
      if (!answers.costume || !answers.scene || !answers.vibe) {
        const optionId = polaroidThemeById(answers.occasionId)?.id || answers.themeId;
        updateAnswers(sceneDefaults(optionId, answers.status));
      }
    }
    if (currentStep === 3) {
      if (answers.personalities.length < 1) return t("seasonalPolaroid.flow.validation.personality");
      if (!answers.habit) return t("seasonalPolaroid.flow.validation.habit");
      if (answers.habit === "custom" && !answers.customHabit.trim()) return t("seasonalPolaroid.flow.validation.habitCustom");
      if (!answers.favoriteTreat || (answers.favoriteTreat === "custom" && !answers.customTreat.trim())) return t("seasonalPolaroid.flow.validation.treat");
      if (!answers.callName) return t("seasonalPolaroid.flow.validation.callName");
      if (answers.callName === "by-name" && !answers.customCallName.trim()) return t("seasonalPolaroid.flow.validation.callNameCustom");
    }
    return null;
  };

  const requestGenerationCode = async () => {
    if (emailRequestPending.current || emailStatus !== "idle") return;
    if (Date.now() < resendAvailableAt) {
      setEmailError(t("seasonalPolaroid.flow.generation.emailResendWait"));
      return;
    }
    const email = normalizeAuthEmail(generationEmail);
    if (!email) {
      setEmailError(t("seasonalPolaroid.flow.generation.emailInvalid"));
      return;
    }
    emailRequestPending.current = true;
    setEmailStatus("sending");
    setEmailError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await requestLetterDownloadCode(client, {
        email,
        redirectTo: authCallbackUrl(
          window.location.origin,
          `${window.location.pathname}${window.location.search}`,
          lang,
        ),
        locale: lang,
      });
      if (result === "sent") {
        setGenerationEmail(email);
        setEmailStep("code");
        const now = Date.now();
        setResendAvailableAt(now + OTP_RESEND_COOLDOWN_MS);
        setCodeExpiresAt(now + OTP_VALIDITY_MS);
        return;
      }
      setEmailError(result === "invalid_email"
        ? t("seasonalPolaroid.flow.generation.emailInvalid")
        : t("seasonalPolaroid.flow.generation.emailSendFailed"));
    } catch {
      setEmailError(t("seasonalPolaroid.flow.generation.emailUnavailable"));
    } finally {
      emailRequestPending.current = false;
      setEmailStatus("idle");
    }
  };

  const verifyGenerationCode = async () => {
    if (emailRequestPending.current || emailStatus !== "idle") return;
    emailRequestPending.current = true;
    setEmailStatus("verifying");
    setEmailError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await verifyLetterDownloadCode(client, {
        email: generationEmail,
        code: generationCode,
      });
      if (result === "authenticated") {
        await authSession.refresh();
        setEmailModalOpen(false);
        setEmailStep("email");
        setEmailStatus("idle");
        await runGeneration();
        return;
      }
      setEmailError(result === "expired"
        ? t("seasonalPolaroid.flow.generation.emailCodeExpired")
        : result === "invalid_code"
          ? t("seasonalPolaroid.flow.generation.emailCodeInvalid")
          : t("seasonalPolaroid.flow.generation.emailVerifyFailed"));
    } catch {
      setEmailError(t("seasonalPolaroid.flow.generation.emailUnavailable"));
    } finally {
      emailRequestPending.current = false;
      setEmailStatus("idle");
    }
  };

  const changeGenerationEmail = () => {
    if (emailRequestPending.current) return;
    setEmailStep("email");
    setGenerationCode("");
    setEmailError(null);
    setEmailStatus("idle");
    setResendAvailableAt(0);
    setCodeExpiresAt(0);
  };

  const generationCodeSecondsLeft = codeExpiresAt > 0
    ? Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000))
    : null;
  const generationCodeTimeLeft = generationCodeSecondsLeft === null
    ? null
    : `${String(Math.floor(generationCodeSecondsLeft / 60)).padStart(2, "0")}:${String(generationCodeSecondsLeft % 60).padStart(2, "0")}`;

  const startGeneration = () => {
    if (view !== "questionnaire") return;
    const validation = validateStep(1) || validateStep(2) || validateStep(3);
    if (validation) {
      setError(validation);
      return;
    }
    if (!primaryPhoto) {
      setError(t("seasonalPolaroid.flow.validation.photo"));
      setStep(1);
      return;
    }
    setError(null);
    setEmailError(null);
    // The server session is the only source of truth. A previous OTP result
    // must not survive a sign-out or expired/revoked session.
    if (authSession.status === "loading") return;
    if (authSession.status === "authenticated") {
      void runGeneration();
      return;
    }
    if (!generationEmail && authSession.email) setGenerationEmail(authSession.email);
    setEmailModalOpen(true);
  };

  const runGeneration = async (allowFromResult = false) => {
    if (view !== "questionnaire" && !allowFromResult) return;
    const validation = validateStep(1) || validateStep(2) || validateStep(3);
    if (validation) {
      setError(validation);
      return;
    }
    if (!primaryPhoto) {
      setError(t("seasonalPolaroid.flow.validation.photo"));
      setStep(1);
      return;
    }
    if (!generationEnabled) {
      setNotice(t("seasonalPolaroid.flow.developmentNotice"));
      return;
    }

    if (!occasionReady) {
      setError(t("seasonalPolaroid.flow.yearRound.occasionNotReady"));
      return;
    }

    const questionnaire: SeasonalPolaroidQuestionnaire = {
      themeId: answers.themeId || "halloween",
      occasionId: answers.occasionId && isPolaroidOccasionAdmitted(answers.occasionId, themeFlags) ? answers.occasionId : "",
      locale: lang,
      petName: answers.petName.trim(),
      species: answers.species,
      status: answers.status,
      costume: answers.costume,
      scene: answers.scene,
      vibe: answers.vibe,
      personalities: answers.personalities,
      habit: answers.habit,
      customHabit: answers.customHabit.trim(),
      favoriteTreat: answers.favoriteTreat,
      customTreat: answers.customTreat.trim(),
      callName: answers.callName,
      customCallName: answers.customCallName.trim(),
      personalDetail: answers.personalDetail.trim(),
      // A regeneration must be a new idempotent request. The initial
      // submission intentionally leaves this empty so safe retries reuse the
      // same job, while each explicit regeneration gets a fresh job/result.
      generationNonce: allowFromResult
        ? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${answers.petName}`)
        : "",
    };
    setError(null);
    setNotice(null);
    setGenerationError(null);
    setGenerationResult(null);
    releaseImagePreview();
    setGenerationStatus("queued");
    setView("developing");
    try {
      const response = await admitSeasonalPolaroid(
        buildSeasonalPolaroidFormData(questionnaire, primaryPhoto.file),
      );
      const session: SeasonalPolaroidGenerationSession = {
        jobId: response.jobId,
        capability: response.capability,
        locale: lang,
        petName: answers.petName.trim(),
      };
      saveSeasonalPolaroidSession(session);
      setGenerationSession(session);
      setGenerationStatus(response.status === "queued" || response.status === "processing" ? response.status : "processing");
      if (typeof response.trialRemaining === "number" && Number.isInteger(response.trialRemaining) && response.trialRemaining >= 0) {
        setTrialRemaining(response.trialRemaining);
      }
    } catch (requestError) {
      setGenerationStatus(null);
      setView("questionnaire");
      const sessionExpired = requestError instanceof SeasonalPolaroidRequestError && requestError.status === 401;
      const message = seasonalRequestErrorMessage(requestError, lang, t);
      setGenerationError(sessionExpired ? null : message);
      setError(sessionExpired ? null : message);
      // A session can expire between the client check and server admission.
      // Refresh the authoritative session state and reopen OTP instead of
      // allowing a stale client flag to retry as if it were authenticated.
      if (sessionExpired) {
        await authSession.refresh();
        setEmailStep("email");
        setGenerationCode("");
        setEmailError(null);
        setEmailModalOpen(true);
      }
      void readSeasonalPolaroidTrial().then((trial) => {
        setDeveloperTesting(trial.developer === true);
        if (trial.remaining !== null) setTrialRemaining(trial.remaining);
      }).catch(() => undefined);
      if (requestError instanceof SeasonalPolaroidRequestError && requestError.code === "guest_trial_exhausted") {
        setTrialRemaining(0);
      }
    }
  };

  const regenerate = () => {
    if (generationStatus || imageLoading || mockMode) return;
    if (!generationEnabled) {
      setNotice(t("seasonalPolaroid.flow.developmentNotice"));
      return;
    }
    clearSeasonalPolaroidSession();
    setGenerationSession(null);
    setGenerationResult(null);
    setGenerationError(null);
    setGenerationStatus(null);
    setSavedNotice(false);
    setSaveError(null);
    releaseImagePreview();
    setMockMode(false);
    if (authSession.status === "authenticated") {
      void runGeneration(true);
      return;
    }
    setView("questionnaire");
    setEmailModalOpen(true);
  };

  const startMockPreview = () => {
    if (process.env.NODE_ENV === "production") return;
    const mockResult: SeasonalPolaroidResult = {
      resultId: "development-mock",
      image: { kind: "data-url", mimeType: "image/jpeg" },
      memo: {
        locale: lang,
        lines: lang === "ko"
          ? [
              `${answers.customCallName || t("seasonalPolaroid.generation.mockOwner")}, 나 ${answers.petName || "아이"}야!`,
              "오늘은 포근한 한 장을 담았어,",
              `${answers.habit ? "작은 습관까지" : "소중한 순간까지"} 마음에 두고,`,
              "여기 참 따뜻하고 좋아.",
            ] as [string, string, string, string]
          : [
              `${answers.customCallName || t("seasonalPolaroid.generation.mockOwner")}, it's ${answers.petName || "me"}!`,
              "I'm cozy in this little scene,",
              `${answers.habit ? "keeping my tiny habit close," : "holding this small moment,"}`,
              "and this quiet day feels like home.",
            ] as [string, string, string, string],
      },
      themeId: (answers.themeId || "halloween") as SeasonalPolaroidResult["themeId"],
      costumeId: answers.costume || "surprise",
      generation: { themeId: (answers.themeId || "halloween") as SeasonalPolaroidResult["themeId"], imageModel: "development-mock", textModel: "development-mock", generatedAt: new Date().toISOString() },
      saveProof: null,
    };
    setMockMode(true);
    setGenerationResult(mockResult);
    setGenerationStatus(null);
    setGenerationError(null);
    releaseImagePreview();
    setImageUrl(primaryPhoto?.url ?? null);
    setView("result");
  };

  const startMockDeveloping = () => {
    if (process.env.NODE_ENV === "production") return;
    releaseImagePreview();
    setMockMode(true);
    setGenerationResult(null);
    setGenerationError(null);
    setGenerationStatus("processing");
    setView("developing");
  };

  const startOver = () => {
    clearSeasonalPolaroidSession();
    const pending = readPendingResultSave();
    if (pending?.kind === "seasonal-polaroid") clearPendingResultSave();
    setGenerationSession(null);
    setGenerationResult(null);
    setGenerationStatus(null);
    setGenerationError(null);
    setMockMode(false);
    releaseImagePreview();
    setView("questionnaire");
  };

  const exportSeasonalPolaroid = async (): Promise<Blob | null> => {
    const node = polaroidRef.current;
    if (!node || !imageUrl || mockMode) return null;
    try {
      // Shared with the My Polaroids gallery, so the file matches the
      // approved on-screen composition on every surface.
      return await exportSeasonalPolaroidPng(node);
    } catch {
      return null;
    }
  };

  const downloadSeasonalPolaroid = async (): Promise<boolean> => {
    if (isDownloading) return false;
    setIsDownloading(true);
    setSaveError(null);
    try {
      const blob = await exportSeasonalPolaroid();
      if (!blob) throw new Error("export_failed");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `soultrace-${answers.petName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "polaroid"}.png`;
      anchor.href = url;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch {
      setSaveError(t("seasonalPolaroid.generation.downloadError"));
      return false;
    } finally {
      setIsDownloading(false);
    }
  };

  const saveSeasonalResult = async (action: "save" | "download"): Promise<"saved" | "save_failed"> => {
    if (saveLock.current) return "saved";
    if (mockMode || !generationSession || !generationResult) {
      setSaveError(t("seasonalPolaroid.generation.saveUnavailable"));
      return "save_failed";
    }
    saveLock.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/account-result/seasonal-polaroid", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          resultId: generationResult.resultId,
          jobId: generationSession.jobId,
          capability: generationSession.capability,
        }),
      });
      const payload = await response.json().catch(() => null) as { status?: string; error?: string } | null;
      if (!response.ok || (payload?.status !== "saved" && payload?.status !== "already_saved")) {
        setSaveError(payload?.error === "authentication_required"
          ? t("seasonalPolaroid.generation.authenticationRequired")
          : t("seasonalPolaroid.generation.saveError"));
        return "save_failed";
      }
      setSavedNotice(true);
      setPendingAction(null);
      const pending = readPendingResultSave();
      if (pending?.kind === "seasonal-polaroid" && pending.resultId === generationResult.resultId) clearPendingResultSave();
      saveSeasonalPolaroidSession({ ...generationSession, pendingAction: undefined });
      if (action === "download") await downloadSeasonalPolaroid();
      await authSession.refresh();
      return "saved";
    } catch {
      setSaveError(t("seasonalPolaroid.generation.saveError"));
      return "save_failed";
    } finally {
      saveLock.current = false;
      setIsSaving(false);
    }
  };

  const requestSeasonalAction = (action: "save" | "download") => {
    if (mockMode) {
      setSaveError(t("seasonalPolaroid.generation.mockSaveUnavailable"));
      return;
    }
    if (authSession.status === "loading") return;
    if (!generationSession || !generationResult) {
      setSaveError(t("seasonalPolaroid.generation.saveError"));
      return;
    }
    if (action === "download" && savedNotice) {
      void downloadSeasonalPolaroid();
      return;
    }
    if (authSession.status === "authenticated") {
      void saveSeasonalResult(action);
      return;
    }
    setPendingAction(action);
    writePendingResultSave({
      kind: "seasonal-polaroid",
      resultId: generationResult.resultId,
      proof: generationSession.capability,
      jobId: generationSession.jobId,
      capability: generationSession.capability,
      action,
    });
    saveSeasonalPolaroidSession({ ...generationSession, pendingAction: action });
    setSaveGateOpen(true);
  };

  useEffect(() => {
    if (view !== "result" || !generationResult || !pendingAction || mockMode || authSession.status !== "authenticated") return;
    void saveSeasonalResult(pendingAction);
    // The save lock prevents duplicate requests while auth/session state settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession.status, generationResult, mockMode, pendingAction, view]);

  useEffect(() => {
    if (view !== "result" || !generationResult || !pendingAction || mockMode || authSession.status !== "anonymous") return;
    setSaveGateOpen(true);
  }, [authSession.status, generationResult, mockMode, pendingAction, view]);

  const goNext = () => {
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      const target = !answers.status ? "polaroid-status" : "polaroid-question-error";
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setError(null);
    if (step < 4) setStep((current) => (current + 1) as Step);
    else void startGeneration();
  };

  const goBack = () => {
    setError(null);
    setNotice(null);
    if (step > 1) setStep((current) => (current - 1) as Step);
  };

  const currentTitle = status === "passed"
    ? t(`seasonalPolaroid.flow.yearRound.screen${step}TitlePassed`)
    : t(`seasonalPolaroid.flow.yearRound.screen${step}Title`);
  const currentIntro = status === "passed"
    ? t(`seasonalPolaroid.flow.yearRound.screen${step}IntroPassed`)
    : t(`seasonalPolaroid.flow.yearRound.screen${step}Intro`);

  if (view !== "questionnaire") {
    return (
      <>
        <PolaroidGenerationExperience
          lang={lang}
          t={t}
          petName={answers.petName}
          status={answers.status}
          generationStatus={generationStatus}
          generationResult={generationResult}
          generationError={generationError}
          imageUrl={imageUrl}
          imageLoading={imageLoading}
          mockMode={mockMode}
          loadingMessageIndex={loadingMessageIndex}
          polaroidRef={polaroidRef}
          savedNotice={savedNotice}
          saveError={saveError}
          isSaving={isSaving}
          isDownloading={isDownloading}
          authStatus={authSession.status}
          generationEnabled={generationEnabled}
          onDownload={() => requestSeasonalAction("download")}
          onSave={() => requestSeasonalAction("save")}
          onShare={async () => {
            try {
              const blob = await exportSeasonalPolaroid();
              if (!blob) {
                setSaveError(t("seasonalPolaroid.flow.yearRound.shareError"));
                return;
              }
              const file = new File([blob], "soultrace-polaroid.png", { type: "image/png" });
              if (navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: answers.petName });
                return;
              }
              setSaveError(t("seasonalPolaroid.flow.yearRound.shareError"));
            } catch {
              setSaveError(t("seasonalPolaroid.flow.yearRound.shareError"));
            }
          }}
          onRegenerate={regenerate}
          onStartOver={startOver}
          onRetry={() => {
            setGenerationError(null);
            setGenerationSession(null);
            setView("questionnaire");
          }}
        />
        <LetterDownloadGate
          open={saveGateOpen}
          purpose="seasonal-polaroid"
          pendingEmail={authSession.email}
          onClose={() => setSaveGateOpen(false)}
          onVerified={async () => {
            const saved = await saveSeasonalResult(pendingAction ?? "save");
            if (saved === "saved") setSaveGateOpen(false);
            return saved;
          }}
        />
      </>
    );
  }

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-[#fffaf0] text-[#393129]" data-polaroid-flow={answers.themeId || "halloween"}>
      <header className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 sm:px-7 md:px-10 md:py-5">
        <Link href="/choose" className={`inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-sm text-[#594b3c] transition hover:text-[#9e774c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9e774c] sm:text-base ${bodyFont}`}>
          <span aria-hidden="true" className="text-xl leading-none">←</span>
          <span>{t("seasonalPolaroid.flow.back")}</span>
        </Link>
        <div className="flex flex-col items-center text-[#6b4a2c]">
          <BrandMark className="h-8 w-8" />
          <p className="font-display-en text-center text-sm tracking-[0.06em]">SoulTrace</p>
        </div>
        <div className="justify-self-end"><LanguageToggle tone="paper" /></div>
      </header>

      <section className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-3 sm:px-7 md:px-10 md:pt-6">
        <div className="mx-auto max-w-[960px]">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display-en text-[10px] uppercase tracking-[0.28em] text-[#9e774c] sm:text-xs">{t("seasonalPolaroid.flow.yearRound.pageTitle")}</p>
            <div className="flex items-center gap-3">
              {generationEnabled ? (
                <p className={`text-xs text-[#9e774c] ${bodyFont}`} aria-live="polite">
                  {developerTesting
                    ? t("seasonalPolaroid.flow.generation.developerUnlimited")
                    : trialRemaining === 0
                    ? t("seasonalPolaroid.flow.generation.freeComplete")
                    : t("seasonalPolaroid.flow.generation.freeRemaining").replace("%COUNT%", String(trialRemaining))}
                </p>
              ) : null}
              <p className={`text-xs text-[#857666] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.stepOf").replace("%STEP%", String(step))}</p>
            </div>
          </div>
          <p className={`mt-3 text-sm leading-6 text-[#594b3c] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.pageIntro")}</p>
          <ol className="mt-4 grid grid-cols-4 gap-1.5 sm:gap-2" aria-label={t("seasonalPolaroid.flow.yearRound.stepOf").replace("%STEP%", String(step))}>
            {STEP_IDS.map((id, index) => {
              const stepNumber = index + 1;
              const complete = stepNumber < step;
              const active = stepNumber === step;
              return (
                <li key={id} className="min-w-0">
                  <div className={`h-1 rounded-full transition-colors ${complete || active ? "bg-[#9e774c]" : "bg-[#dfceb6]"}`} />
                  <span className={`mt-2 block truncate text-[9px] uppercase tracking-[0.12em] sm:text-[10px] ${active ? "text-[#9e774c]" : "text-[#887D6F]"} ${lang === "ko" ? "font-ko" : "font-display-en"}`}>
                    {t(`seasonalPolaroid.flow.yearRound.steps.${id}`)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mx-auto mt-7 grid max-w-[1120px] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.74fr)] lg:items-start lg:gap-8">
          <section className="order-2 min-w-0 rounded-[24px] border border-[#eadcc6] bg-[#fffbf3] p-5 shadow-[0_8px_28px_rgba(121,92,53,0.08)] sm:p-7 lg:order-1" aria-labelledby="polaroid-question-title">
            <p className={`text-[10px] uppercase tracking-[0.25em] text-[#9e774c] sm:text-xs ${lang === "ko" ? "font-ko" : "font-display-en"}`}>{t(`seasonalPolaroid.flow.yearRound.screen${step}Kicker`)}</p>
            <h1 id="polaroid-question-title" className={`mt-4 text-[1.65rem] font-light leading-tight text-[#393129] sm:text-3xl ${bodyFont}`}>{currentTitle}</h1>
            <p className={`mt-3 max-w-2xl whitespace-pre-line text-sm font-extralight leading-7 text-[#594b3c] sm:text-base ${bodyFont}`}>{currentIntro}</p>

            <div className="mt-7">
              {step === 1 ? (
                <div className="space-y-7">
                  {savedPets.length ? (
                    <div className="space-y-2">
                      <p className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.useSavedPet")}</p>
                      <p className={`text-xs leading-5 text-[#857666] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.savedPetHint")}</p>
                      <div className="flex flex-wrap gap-2">
                        {savedPets.map((pet) => (
                          <button key={pet.petId} type="button" onClick={() => applySavedPet(pet)} className={`min-h-10 rounded-full border border-[#eadcc6] bg-[#fff8ec] px-3 py-2 text-xs text-[#393129] transition hover:border-[#9e774c] ${bodyFont}`}>
                            {pet.petName}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <label htmlFor="seasonal-pet-name" className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen1.nameLabel")}</label>
                    <input id="seasonal-pet-name" type="text" maxLength={12} value={answers.petName} onChange={(event) => updateAnswers({ petName: event.target.value.slice(0, 12) }, { kind: "default" })} placeholder={t("seasonalPolaroid.flow.screen1.namePlaceholder")} className={fieldClass(lang, Boolean(error && !answers.petName.trim()))} />
                    <p className={`text-right text-xs text-[#8F8578] ${bodyFont}`}>{answers.petName.length} / 12</p>
                  </div>
                  <OptionGroup label={t("seasonalPolaroid.flow.screen1.speciesLabel")} options={SPECIES_OPTIONS} selected={answers.species} onSelect={(id) => updateSpecies(id as PolaroidSpecies)} bodyFont={bodyFont} />
                  <div id="polaroid-status">
                    <OptionGroup label={t("seasonalPolaroid.flow.screen1.statusLabel")} options={[{ id: "living", emoji: "✦", labelKey: "options.status.living" }, { id: "passed", emoji: "✦", labelKey: "options.status.passed" }]} selected={answers.status} onSelect={(id) => updateStatus(id as PolaroidStatus)} bodyFont={bodyFont} />
                  </div>
                  <input ref={primaryInputRef} type="file" accept={SEASONAL_POLAROID_PHOTO_ACCEPT} className="hidden" onChange={(event) => onPhotoInput(event.target.files)} />
                  <PhotoSlotView photo={primaryPhoto} label={t("seasonalPolaroid.flow.screen2.primaryLabel")} emptyLabel={t("seasonalPolaroid.flow.screen2.empty")} uploadLabel={t("seasonalPolaroid.flow.screen2.upload")} changeLabel={t("seasonalPolaroid.flow.screen2.change")} removeLabel={t("seasonalPolaroid.flow.screen2.remove")} onChoose={openPhotoPicker} onRemove={removePhoto} required bodyFont={bodyFont} />
                  <div className="rounded-2xl border border-[#eadcc6] bg-[#fff8ec] p-4">
                    <p className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen2.tipsTitle")}</p>
                    <p className={`mt-2 text-xs leading-6 text-[#857666] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen2.tips")}</p>
                    <p className={`mt-3 text-[11px] text-[#8F8578] ${bodyFont}`}>{t("seasonalPolaroid.flow.photoLimit")}</p>
                    <p className={`mt-1 text-[11px] leading-5 text-[#8F8578] ${bodyFont}`}>{t("seasonalPolaroid.flow.photoHeic")}</p>
                  </div>
                  {photoError ? <p role="alert" className={`text-sm leading-6 text-red-700 ${bodyFont}`}>{photoError}</p> : null}
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-10">
                  {yearRoundEnabled ? (
                    <section className="space-y-3">
                      <h2 className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.artCategory")}</h2>
                      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3" data-polaroid-art-count={artThemes.length}>
                        {artThemes.map((item) => (
                          <ThemeCard key={item.id} entry={item} selected={answers.themeId === item.id} locale={lang} onSelect={() => updateTheme(item.id)} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <section className="space-y-3" data-polaroid-occasion-list="">
                    <div className="space-y-2">
                      <h2 className={`text-center text-sm tracking-[0.12em] text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.seasonalCategory")}</h2>
                      <p className={`text-sm leading-6 text-[#594b3c] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.occasionHint")}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {POLAROID_OCCASION_GROUPS.flatMap((group) => group.items).map((item) => {
                        const ready = item.implemented && isPolaroidOccasionAdmitted(item.id, themeFlags);
                        const selected = answers.occasionId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${lang === "ko" ? item.titleKo : item.titleEn}${ready ? "" : ` — ${t("seasonalPolaroid.flow.yearRound.comingSoon")}`}`}
                            onClick={() => updateOccasion(item.id)}
                            className={`min-h-12 rounded-full border px-3 py-3 text-center text-sm leading-5 transition ${selected ? "border-[#9e774c] bg-[#f1e5cf] text-[#393129]" : "border-[#eadcc6] bg-[#fff8ec] text-[#463021] hover:border-[#9e774c]/60"} ${bodyFont}`}
                          >
                            {lang === "ko" ? item.titleKo : item.titleEn}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-8">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3"><p className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen5.personalityLabel")}</p><span className={`text-xs text-[#9e774c] ${bodyFont}`}>{t("seasonalPolaroid.flow.personalityCount").replace("%COUNT%", String(answers.personalities.length))}</span></div>
                    <div className="grid min-w-0 grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2">
                      {theme.personalities.map((item) => <ChoiceButton key={item.id} option={item} label={label(item)} selected={answers.personalities.includes(item.id)} onClick={() => {
                        const selected = answers.personalities.includes(item.id);
                        if (!selected && answers.personalities.length >= 2) return;
                        const personalities = selected ? answers.personalities.filter((id) => id !== item.id) : [...answers.personalities, item.id];
                        updateAnswers({ personalities }, { kind: "personality", id: item.id });
                      }} bodyFont={bodyFont} multi />)}
                    </div>
                  </div>
                  <OptionGroup label={t("seasonalPolaroid.flow.screen5.habitLabel")} options={habitOptions} selected={answers.habit} onSelect={(id) => updateAnswers({ habit: id, ...(id === "custom" ? {} : { customHabit: "" }) }, { kind: "habit" })} bodyFont={bodyFont} />
                  {answers.habit === "custom" ? <input type="text" maxLength={60} value={answers.customHabit} onChange={(event) => updateAnswers({ customHabit: event.target.value.slice(0, 60) })} placeholder={t("seasonalPolaroid.flow.screen5.habitCustomPlaceholder")} className={fieldClass(lang)} /> : null}
                  <div>
                    <p className={`mb-3 text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen6.treatLabel")}</p>
                    <div className="grid min-w-0 grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2">
                      {availableTreats.map((item) => <ChoiceButton key={item.id} option={item} label={label(item)} selected={answers.favoriteTreat === item.id} onClick={() => updateAnswers({ favoriteTreat: item.id }, { kind: "treat" })} bodyFont={bodyFont} />)}
                    </div>
                    {answers.favoriteTreat === "custom" ? <input type="text" maxLength={60} value={answers.customTreat} onChange={(event) => updateAnswers({ customTreat: event.target.value.slice(0, 60) })} placeholder={t("seasonalPolaroid.flow.screen6.treatCustomPlaceholder")} className={`mt-3 ${fieldClass(lang)}`} /> : null}
                  </div>
                  <OptionGroup label={t(status === "passed" ? "seasonalPolaroid.flow.screen6.callNameLabelPassed" : "seasonalPolaroid.flow.screen6.callNameLabel")} options={theme.callNames} selected={answers.callName} onSelect={(id) => updateAnswers({ callName: id }, { kind: "callName" })} bodyFont={bodyFont} />
                  {answers.callName === "by-name" ? <input type="text" maxLength={40} value={answers.customCallName} onChange={(event) => updateAnswers({ customCallName: event.target.value.slice(0, 40) })} placeholder={t("seasonalPolaroid.flow.screen6.callNameCustomPlaceholder")} className={fieldClass(lang)} /> : null}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3"><label htmlFor="seasonal-detail" className={`text-sm text-[#393129] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen6.personalLabel")}</label><span className={`text-xs text-[#8F8578] ${bodyFont}`}>{t("seasonalPolaroid.flow.screen6.characterCount").replace("%COUNT%", String(answers.personalDetail.length))}</span></div>
                    <textarea id="seasonal-detail" maxLength={60} rows={3} value={answers.personalDetail} onChange={(event) => updateAnswers({ personalDetail: event.target.value.slice(0, 60) })} placeholder={t("seasonalPolaroid.flow.screen6.personalPlaceholder")} className={`resize-none ${fieldClass(lang)}`} />
                  </div>
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-5">
                  <p className={`text-sm leading-6 text-[#594b3c] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.previewHint")}</p>
                  <dl className={`grid gap-3 text-sm text-[#393129] ${bodyFont}`}>
                    <div className="rounded-2xl border border-[#eadcc6] bg-[#fff8ec] px-4 py-3"><dt className="text-xs text-[#857666]">{t("seasonalPolaroid.flow.yearRound.artStyleLabel")}</dt><dd className="mt-1">{selectedTheme ? polaroidThemeTitle(selectedTheme, lang) : answers.themeId}</dd></div>
                    <div className="rounded-2xl border border-[#eadcc6] bg-[#fff8ec] px-4 py-3"><dt className="text-xs text-[#857666]">{t("seasonalPolaroid.flow.yearRound.occasionLabel")}</dt><dd className="mt-1">{selectedOccasion ? (lang === "ko" ? selectedOccasion.titleKo : selectedOccasion.titleEn) : t("seasonalPolaroid.flow.yearRound.occasionNone")}</dd></div>
                    <div className="rounded-2xl border border-[#eadcc6] bg-[#fff8ec] px-4 py-3"><dt className="text-xs text-[#857666]">{t("seasonalPolaroid.flow.screen1.nameLabel")}</dt><dd className="mt-1">{answers.petName}</dd></div>
                  </dl>
                  {!occasionReady ? <p role="status" className={`text-sm leading-6 text-[#9e774c] ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.occasionNotReady")}</p> : null}
                  {primaryPhoto ? <img src={primaryPhoto.url} alt="" className="h-auto w-full rounded-2xl border border-[#eadcc6] object-contain" /> : null}
                </div>
              ) : null}
            </div>

            {error ? <p id="polaroid-question-error" role="alert" className={`mt-6 rounded-xl border border-[#d8b4a0] bg-[#fff1ea] px-4 py-3 text-sm leading-6 text-[#7a3e2b] ${bodyFont}`}>{error}</p> : null}
            {notice ? <p role="status" className={`mt-6 rounded-xl border border-[#eadcc6] bg-[#fff8ec] px-4 py-3 text-sm leading-6 text-[#594b3c] ${bodyFont}`}>{notice}</p> : null}

            <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadcc6] pt-6" aria-label="Polaroid questionnaire navigation">
              <button type="button" onClick={goBack} disabled={step === 1} className={`min-h-12 rounded-xl border border-[#b7a38b] px-5 py-3 text-sm text-[#393129] transition hover:bg-[#f1e5cf] disabled:cursor-not-allowed disabled:opacity-35 ${bodyFont}`}>{t("seasonalPolaroid.flow.backStep")}</button>
              <div className="ml-auto flex flex-wrap justify-end gap-3">
                <button type="button" onClick={goNext} disabled={(step === 4 && authSession.status === "loading") || (step === 4 && !occasionReady)} className={`min-h-12 rounded-xl bg-[#9e774c] px-6 py-3 text-sm font-medium text-[#fffaf2] transition hover:bg-[#8d6a43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9e774c] disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}>
                  {step === 4 ? t("seasonalPolaroid.flow.yearRound.createPolaroid") : t("seasonalPolaroid.flow.next")}
                </button>
              </div>
            </nav>
          </section>

          <aside className="order-1 min-w-0 lg:sticky lg:top-6 lg:order-2" aria-label={t("seasonalPolaroid.flow.preview.label")}>
            <div className="rounded-[24px] border border-[#eadcc6] bg-[#fffbf3] p-4 shadow-[0_8px_28px_rgba(121,92,53,0.08)] sm:p-5">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="font-display-en text-[10px] uppercase tracking-[0.28em] text-[#9e774c]">{t("seasonalPolaroid.flow.preview.label")}</p>
              </div>
              <div className="mx-auto mt-4 w-[min(100%,350px)]">
                {answers.themeId ? (
                  <SeasonalPolaroidFrame
                    lang={lang}
                    t={t}
                    themeId={answers.themeId}
                    imageUrl={primaryPhoto?.url ?? null}
                    imageAlt={t("polaroidPreviewAlt")}
                    memoLines={["", "", "", ""]}
                    showMemo={false}
                    placeholder={!primaryPhoto}
                    className={`${SEASONAL_POLAROID_FRAME_BASE_CLASS} rounded-[12px]`}
                  />
                ) : (
                  <div className="rounded-[18px] border border-[#eadcc6] bg-[#fff8ec] p-3">
                    <div className="relative overflow-hidden rounded-xl bg-[#f3e6cf]">
                      {primaryPhoto ? <img src={primaryPhoto.url} alt={t("polaroidPreviewAlt")} className="h-auto w-full object-contain" /> : <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center text-[#857666]"><p className={`text-xs leading-6 ${bodyFont}`}>{t("seasonalPolaroid.flow.preview.placeholder")}</p></div>}
                    </div>
                    <div className="pt-3 text-center text-[#4C3829]">
                      <p className="font-display-en text-[10px] uppercase tracking-[0.3em]">SOUL TRACE</p>
                      <p className={`mt-1 text-base font-medium ${lang === "ko" ? "font-ko" : "font-display-en !tracking-normal"}`}>{answers.petName || t("polaroid.previewLabel")}</p>
                      <p className={`mt-1 text-xs ${lang === "ko" ? "font-ko" : "font-display-en !tracking-normal"}`}>{t("seasonalPolaroid.flow.yearRound.themeLabel")}</p>
                    </div>
                  </div>
                )}
                {answers.themeId ? (
                  <p className={`mt-3 text-center text-xs text-[#857666] ${bodyFont}`}>{selectedTheme ? polaroidThemeTitle(selectedTheme, lang) : answers.themeId}</p>
                ) : null}
              </div>

              {step >= 2 && answers.petName ? <div className="mt-5 rounded-2xl border border-[#eadcc6] bg-[#fff8ec] px-4 py-3.5" aria-live="polite">
                <p className={`text-[10px] uppercase tracking-[0.24em] text-[#9e774c] ${lang === "ko" ? "font-ko" : "font-display-en"}`}>{t("seasonalPolaroid.flow.preview.whisperLabel")}</p>
                <p key={`${whisperTrigger.kind}-${"id" in whisperTrigger ? whisperTrigger.id : ""}-${status}`} className={`mt-2 text-sm leading-7 text-[#393129] animate-fade-in ${bodyFont}`}>“{whisperText}”</p>
              </div> : null}

              {selectedChips.length ? <div className="mt-5">
                <p className={`px-1 text-[10px] uppercase tracking-[0.24em] text-[#8F8578] ${lang === "ko" ? "font-ko" : "font-display-en"}`}>{t("seasonalPolaroid.flow.preview.selections")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedChips.map((item) => <span key={item.id} className={`rounded-full border border-[#D4AF37]/28 bg-black/30 px-2.5 py-1.5 text-xs text-[#DCCDB8] ${bodyFont}`}>{item.emoji} {label(item)}</span>)}
                </div>
              </div> : null}
            </div>
          </aside>
        </div>
      </section>

      {emailModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="seasonal-email-title" className="relative w-full max-w-md rounded-[28px] border border-[#D4AF37]/45 bg-[#15110D] px-6 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.7)] sm:px-9 sm:py-10">
            <button type="button" onClick={() => { setEmailModalOpen(false); setEmailError(null); }} aria-label={t("seasonalPolaroid.flow.generation.emailClose")} className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full text-2xl font-light text-[#B6AA99] transition hover:bg-[#D4AF37]/10 hover:text-[#F5E6C8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]">×</button>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/10 text-[#F0C65A]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </svg>
            </div>
            <h2 id="seasonal-email-title" className={`mt-6 text-center text-2xl font-light text-[#FFF0D0] sm:text-3xl ${bodyFont}`}>
              {t(emailStep === "code" ? "seasonalPolaroid.flow.generation.emailCodeHeading" : "seasonalPolaroid.flow.generation.emailHeading")}
            </h2>
            <p className={`mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-[#D8C9B3] ${bodyFont}`}>
              {t(emailStep === "code" ? "seasonalPolaroid.flow.generation.emailCodeDescription" : "seasonalPolaroid.flow.generation.emailDescription")}
            </p>
            {emailStep === "email" ? (
              <form className="mt-7" noValidate onSubmit={(event) => { event.preventDefault(); void requestGenerationCode(); }}>
                <label htmlFor="seasonal-generation-email" className={`mb-2 block text-sm text-[#F3EAD8] ${bodyFont}`}>{t("seasonalPolaroid.flow.generation.emailLabel")}</label>
                <input id="seasonal-generation-email" type="email" inputMode="email" autoComplete="email" autoFocus value={generationEmail} onChange={(event) => { setGenerationEmail(event.target.value); setEmailError(null); }} placeholder={t("seasonalPolaroid.flow.generation.emailPlaceholder")} className={fieldClass(lang, Boolean(emailError))} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "seasonal-generation-email-error" : "seasonal-generation-email-supporting"} disabled={emailStatus !== "idle"} />
                {emailError ? <p id="seasonal-generation-email-error" role="alert" className={`mt-2 text-sm text-red-200 ${bodyFont}`}>{emailError}</p> : null}
                <button type="submit" disabled={emailStatus !== "idle"} className={`mt-5 min-h-12 w-full rounded-xl bg-[#C9A43A] px-5 py-3 text-sm font-medium text-[#1B120A] shadow-[0_8px_24px_rgba(201,164,58,0.18)] transition hover:bg-[#E0BD56] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3EAD8] ${bodyFont}`}>
                  {emailStatus === "sending" ? t("seasonalPolaroid.flow.generation.emailSending") : t("seasonalPolaroid.flow.generation.emailContinue")}
                </button>
              </form>
            ) : (
              <form className="mt-7" onSubmit={(event) => { event.preventDefault(); void verifyGenerationCode(); }}>
                <p className={`mb-4 text-center text-sm text-[#D8B84C] ${bodyFont}`}>{generationEmail}</p>
                <label htmlFor="seasonal-generation-code" className={`mb-2 block text-sm text-[#F3EAD8] ${bodyFont}`}>{t("seasonalPolaroid.flow.generation.emailCodeLabel")}</label>
                <input id="seasonal-generation-code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus value={generationCode} onChange={(event) => { setGenerationCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setEmailError(null); }} placeholder={t("seasonalPolaroid.flow.generation.emailCodePlaceholder")} className={`${fieldClass(lang, Boolean(emailError))} text-center tracking-[0.35em]`} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "seasonal-generation-code-error" : "seasonal-generation-code-supporting"} disabled={emailStatus !== "idle"} />
                {generationCodeTimeLeft !== null ? (
                  <p className={`mt-3 text-center text-sm text-[#D8B84C] ${bodyFont}`} aria-live="off">
                    {generationCodeSecondsLeft === 0
                      ? t("seasonalPolaroid.flow.generation.emailCodeExpired")
                      : t("seasonalPolaroid.flow.generation.emailCodeExpiresIn").replace("%TIME%", generationCodeTimeLeft)}
                  </p>
                ) : null}
                {emailError ? <p id="seasonal-generation-code-error" role="alert" className={`mt-2 text-sm text-red-200 ${bodyFont}`}>{emailError}</p> : null}
                <button type="submit" disabled={emailStatus !== "idle" || generationCode.length !== 6} className={`mt-5 min-h-12 w-full rounded-xl bg-[#C9A43A] px-5 py-3 text-sm font-medium text-[#1B120A] shadow-[0_8px_24px_rgba(201,164,58,0.18)] transition hover:bg-[#E0BD56] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F3EAD8] ${bodyFont}`}>
                  {emailStatus === "verifying" ? t("seasonalPolaroid.flow.generation.emailVerifying") : t("seasonalPolaroid.flow.generation.emailVerify")}
                </button>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
                  <button type="button" onClick={() => void requestGenerationCode()} disabled={emailStatus !== "idle" || Date.now() < resendAvailableAt} className={`text-[#D8B84C] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-45 ${bodyFont}`}>
                    {t("seasonalPolaroid.flow.generation.emailResend")}
                  </button>
                  <button type="button" onClick={changeGenerationEmail} disabled={emailStatus !== "idle"} className={`text-[#B9AE9B] underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-45 ${bodyFont}`}>
                    {t("seasonalPolaroid.flow.generation.emailChange")}
                  </button>
                </div>
              </form>
            )}
            <p id="seasonal-generation-email-supporting" className={`mt-5 text-center text-xs leading-5 text-[#9F927F] ${bodyFont}`}>
              {emailError ? "" : t(emailStep === "code" ? "seasonalPolaroid.flow.generation.emailCodeSupporting" : "seasonalPolaroid.flow.generation.emailSupporting")}
            </p>
          </div>
        </div>
      ) : null}
      <StoryTabbar current="create" {...storyTabProps(petFirstCopy(lang), null)} />
    </main>
  );
}

function ThemeCard({
  entry,
  selected,
  locale,
  onSelect,
}: {
  entry: PolaroidThemeCatalogEntry;
  selected: boolean;
  locale: Locale;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border text-left transition ${selected ? "border-[#9e774c] bg-[#f1e5cf]" : "border-[#eadcc6] bg-[#fff8ec]"}`}
    >
      <span className="relative block aspect-square w-full bg-[#f3e6cf]">
        <img src={entry.thumb} alt="" className="h-full w-full object-contain" />
        {selected ? <span className="absolute right-2 top-2 rounded-full bg-[#9e774c] px-2 py-0.5 text-[10px] text-[#fffaf2]" aria-hidden="true">✓</span> : null}
      </span>
      <span className="block px-3 pt-2 text-sm text-[#393129]">{locale === "ko" ? entry.titleKo : entry.titleEn}</span>
      <span className="block px-3 pb-3 text-[11px] leading-5 text-[#857666]">{locale === "ko" ? entry.hintKo : entry.hintEn}</span>
    </button>
  );
}

function OptionGroup({
  label,
  options,
  selected,
  onSelect,
  bodyFont,
}: {
  label: string;
  options: readonly SeasonalOption[];
  selected: string;
  onSelect: (id: string) => void;
  bodyFont: string;
}) {
  const { t } = useLocale();

  return (
    <div>
      {label ? <p className={`mb-3 text-sm text-[#594b3c] ${bodyFont}`}>{label}</p> : null}
      <div className="grid min-w-0 grid-cols-1 auto-rows-fr gap-3 sm:grid-cols-2">
        {options.map((item) => <ChoiceButton key={item.id} option={item} label={t(optionPath(item))} selected={selected === item.id} onClick={() => onSelect(item.id)} bodyFont={bodyFont} />)}
      </div>
    </div>
  );
}

function PhotoSlotView({
  photo,
  label,
  emptyLabel,
  uploadLabel,
  changeLabel,
  removeLabel,
  onChoose,
  onRemove,
  required = false,
  bodyFont,
}: {
  photo: LocalPhoto | null;
  label: string;
  emptyLabel: string;
  uploadLabel: string;
  changeLabel: string;
  removeLabel: string;
  onChoose: () => void;
  onRemove: () => void;
  required?: boolean;
  bodyFont: string;
}) {
  return (
    <div className="rounded-2xl border border-[#eadcc6] bg-[#fff8ec] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm text-[#393129] ${bodyFont}`}>{label}</p>
        {required ? <span className="text-xs text-[#9e774c]">*</span> : null}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-[#eadcc6] bg-[#f3e6cf] sm:size-28">
          {photo ? <img src={photo.url} alt="" className="h-full w-full object-contain" /> : <button type="button" onClick={onChoose} className={`flex h-full w-full flex-col items-center justify-center px-2 text-center text-xs text-[#857666] transition hover:bg-[#f1e5cf] focus-visible:outline-2 focus-visible:outline-[#9e774c] ${bodyFont}`}><span className="text-xl" aria-hidden="true">＋</span><span className="mt-1">{emptyLabel}</span></button>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onChoose} className={`min-h-10 rounded-lg border border-[#b7a38b] bg-[#fffaf0] px-3 py-2 text-xs text-[#393129] transition hover:bg-[#f1e5cf] focus-visible:outline-2 focus-visible:outline-[#9e774c] ${bodyFont}`}>{photo ? changeLabel : uploadLabel}</button>
            {photo ? <button type="button" onClick={onRemove} className={`min-h-10 rounded-lg px-2 py-2 text-xs text-[#857666] underline underline-offset-4 transition hover:text-[#7a3e2b] focus-visible:outline-2 focus-visible:outline-[#9e774c] ${bodyFont}`}>{removeLabel}</button> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PolaroidGenerationExperience({
  lang,
  t,
  petName,
  status,
  generationStatus,
  generationResult,
  generationError,
  imageUrl,
  imageLoading,
  mockMode,
  loadingMessageIndex,
  polaroidRef,
  savedNotice,
  saveError,
  isSaving,
  isDownloading,
  authStatus,
  generationEnabled,
  onDownload,
  onSave,
  onShare,
  onRegenerate,
  onStartOver,
  onRetry,
}: {
  lang: Locale;
  t: (path: string) => string;
  petName: string;
  status: PolaroidStatus | "";
  generationStatus: "queued" | "processing" | null;
  generationResult: (SeasonalPolaroidResult | SeasonalPolaroidPreviewResult) | null;
  generationError: string | null;
  imageUrl: string | null;
  imageLoading: boolean;
  mockMode: boolean;
  loadingMessageIndex: number;
  polaroidRef: RefObject<HTMLDivElement | null>;
  savedNotice: boolean;
  saveError: string | null;
  isSaving: boolean;
  isDownloading: boolean;
  authStatus: "loading" | "authenticated" | "anonymous";
  generationEnabled: boolean;
  onDownload: () => void;
  onSave: () => void;
  onShare: () => void;
  onRegenerate: () => void;
  onStartOver: () => void;
  onRetry: () => void;
}) {
  const passed = status === "passed";
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const loadingMessages = passed
    ? [
        t("seasonalPolaroid.generation.messages.passedOne"),
        t("seasonalPolaroid.generation.messages.passedTwo"),
        t("seasonalPolaroid.generation.messages.passedThree"),
      ]
    : [
        t("seasonalPolaroid.generation.messages.livingOne"),
        t("seasonalPolaroid.generation.messages.livingTwo"),
        t("seasonalPolaroid.generation.messages.livingThree"),
      ];
  const loadingMessage = loadingMessages[loadingMessageIndex % loadingMessages.length].replaceAll("%NAME%", petName || t("seasonalPolaroid.generation.mockOwner"));
  const memoLines = generationResult?.memo.lines ?? [];
  const hasTerminalError = Boolean(generationError && !generationStatus);

  return (
    <main className="relative flex min-h-[100svh] flex-col overflow-x-hidden bg-[#fffaf0] text-[#393129]">
      <header className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 sm:px-7 md:px-10 md:py-5">
        <button type="button" onClick={onStartOver} className={`inline-flex min-h-11 w-fit items-center rounded-md text-sm text-[#594b3c] transition hover:text-[#9e774c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9e774c] sm:text-base ${bodyFont}`}>
          {t("seasonalPolaroid.flow.back")}
        </button>
        <div className="flex flex-col items-center text-[#6b4a2c]">
          <BrandMark className="h-8 w-8" />
          <p className="font-display-en text-center text-sm tracking-[0.06em]">SoulTrace</p>
        </div>
        <div className="justify-self-end"><LanguageToggle tone="paper" /></div>
      </header>

      <section className="mx-auto flex w-full max-w-[960px] flex-col items-center px-5 pb-16 pt-7 sm:px-8 sm:pt-12" aria-busy={Boolean(generationStatus || imageLoading)}>
        <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37] sm:text-xs">{t("seasonalPolaroid.generation.eyebrow")}</p>
        <h1 className={`mt-5 text-center text-2xl font-light text-[#393129] sm:text-4xl ${bodyFont}`}>
          {generationResult && !generationStatus ? t("seasonalPolaroid.generation.readyTitle") : t("seasonalPolaroid.generation.developingTitle")}
        </h1>
        {petName ? <p className={`mt-3 text-center text-sm text-[#B6AA99] ${bodyFont}`}>{petName}</p> : null}

        <div className="mt-8 w-full max-w-[430px]">
          <PolaroidResultFrame
            polaroidRef={polaroidRef}
            lang={lang}
            t={t}
            themeId={answers.themeId}
            imageUrl={imageUrl}
            memoLines={memoLines}
            showMemo={Boolean(generationResult && !imageLoading)}
            placeholder={!generationResult || imageLoading || !imageUrl}
            mockMode={mockMode}
          />
        </div>

        {generationStatus ? (
          <div className="mt-7 w-full max-w-[430px] text-center" role="status" aria-live="polite">
            <p key={loadingMessage} className={`animate-fade-in text-sm text-[#F4E7D0] ${bodyFont}`}>{loadingMessage}</p>
            <div className="mt-4 flex items-center justify-center gap-2" aria-label={t("seasonalPolaroid.generation.inProgress")}>
              {[0, 1, 2].map((dot) => <span key={dot} className="size-1.5 rounded-full bg-[#D4AF37] motion-safe:animate-pulse" style={{ animationDelay: `${dot * 180}ms` }} />)}
            </div>
            <p className={`mt-3 text-xs text-[#8F8578] ${bodyFont}`}>{generationStatus === "processing" ? t("seasonalPolaroid.generation.processing") : t("seasonalPolaroid.generation.queued")}</p>
          </div>
        ) : null}

        {generationError ? (
          <div className={`mt-7 w-full max-w-[520px] rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[0.06] px-5 py-4 text-center ${bodyFont}`} role="alert">
            <p className="text-sm leading-6 text-[#F3EAD8]">{generationError}</p>
            {hasTerminalError ? <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl border border-[#D4AF37]/50 px-5 py-2 text-sm text-[#F0CF71] transition hover:bg-[#D4AF37]/10 focus-visible:outline-2 focus-visible:outline-[#D4AF37]">{t("seasonalPolaroid.generation.retry")}</button> : null}
          </div>
        ) : null}

        {generationResult && !generationStatus && !imageLoading && !generationError ? (
          <div className="mt-8 w-full max-w-[520px]">
            {saveError ? <p role="alert" className={`mb-4 rounded-xl border border-red-300/25 bg-red-950/20 px-4 py-3 text-center text-sm leading-6 text-red-100 ${bodyFont}`}>{saveError}</p> : null}
            {savedNotice ? <p role="status" className={`mb-4 text-center text-sm text-[#F0CF71] ${bodyFont}`}>{t("seasonalPolaroid.generation.saved")}</p> : null}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" disabled={mockMode || isSaving || isDownloading || authStatus === "loading"} onClick={onSave} className={`min-h-12 rounded-xl border border-[#b7a38b] px-5 py-3 text-sm text-[#393129] transition hover:bg-[#f1e5cf] disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}>{isSaving ? t("seasonalPolaroid.generation.saving") : t("seasonalPolaroid.generation.save")}</button>
              <button type="button" disabled={mockMode || isSaving || isDownloading || authStatus === "loading"} onClick={onDownload} className={`min-h-12 rounded-xl bg-[#9e774c] px-5 py-3 text-sm font-medium text-[#fffaf2] transition hover:bg-[#8d6a43] focus-visible:outline-2 focus-visible:outline-[#9e774c] disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}>{isDownloading ? t("seasonalPolaroid.generation.downloading") : t("seasonalPolaroid.generation.download")}</button>
              <button type="button" disabled={mockMode || isSaving || isDownloading} onClick={onShare} className={`min-h-12 rounded-xl border border-[#b7a38b] px-5 py-3 text-sm text-[#393129] transition hover:bg-[#f1e5cf] disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}>{t("seasonalPolaroid.flow.yearRound.share")}</button>
              <button type="button" disabled={!generationEnabled || mockMode || isSaving || isDownloading || authStatus === "loading"} onClick={onRegenerate} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#b7a38b] px-5 py-3 text-sm text-[#393129] transition hover:bg-[#f1e5cf] focus-visible:outline-2 focus-visible:outline-[#9e774c] disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}><LuRefreshCw aria-hidden="true" className="size-4" />{t("seasonalPolaroid.generation.regenerate")}</button>
            </div>
            <Link href="/my-polaroids" className={`mt-5 inline-flex min-h-10 items-center justify-center text-sm text-[#D8B84C] underline underline-offset-4 transition hover:text-[#F5E6C8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] ${bodyFont}`}>
              {t("seasonalPolaroid.generation.viewMyPolaroids")}
            </Link>
            <Link href="/premium" className={`mt-3 block text-center text-sm text-[#857666] underline underline-offset-4 ${bodyFont}`}>
              {lang === "ko" ? "다른 스타일로 더 만들기" : "Make another style"}
            </Link>
            <p className={`mt-2 text-center text-xs leading-5 text-[#857666] ${bodyFont}`}>
              {lang === "ko" ? "이 결과는 결제 없이 저장할 수 있어요. 추가 제작은 판매 준비 중이에요." : "This result can be saved without paying. Extra styles are not for sale yet."}
            </p>
          </div>
        ) : null}

        {mockMode ? <p className={`mt-5 rounded-full border border-[#D4AF37]/40 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#D8B84C] ${bodyFont}`}>{t("seasonalPolaroid.generation.mockBadge")}</p> : null}
        <button type="button" onClick={onStartOver} className={`mt-8 min-h-11 text-sm text-[#857666] underline underline-offset-4 transition hover:text-[#9e774c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9e774c] ${bodyFont}`}>{t("seasonalPolaroid.generation.startOver")}</button>
      </section>
      <StoryTabbar current="create" {...storyTabProps(petFirstCopy(lang), null)} />
    </main>
  );
}

function PolaroidResultFrame({
  polaroidRef,
  lang,
  t,
  themeId,
  imageUrl,
  memoLines,
  showMemo,
  placeholder,
  mockMode,
}: {
  polaroidRef: RefObject<HTMLDivElement | null>;
  lang: Locale;
  t: (path: string) => string;
  themeId: string;
  imageUrl: string | null;
  memoLines: string[];
  showMemo: boolean;
  placeholder: boolean;
  mockMode: boolean;
}) {
  // One composition for the result page, the gallery, and the PNG export.
  return (
    <SeasonalPolaroidFrame
      polaroidRef={polaroidRef}
      lang={lang}
      t={t}
      themeId={themeId}
      imageUrl={imageUrl}
      memoLines={memoLines}
      showMemo={showMemo}
      placeholder={placeholder}
      badge={mockMode ? "SOUL TRACE · MOCK" : null}
    />
  );
}
