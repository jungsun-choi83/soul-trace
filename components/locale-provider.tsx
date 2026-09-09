"use client";

import ko from "@/locales/ko.json";
import en from "@/locales/en.json";
import type { Locale, Messages } from "@/lib/i18n";
import { getMessage, isLocale } from "@/lib/i18n";
import { AUTH_LOCALE_COOKIE } from "@/lib/passwordless-auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "soul-trace-locale";

const messages: Record<Locale, Messages> = { ko, en };

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "ko";
  const lang =
    navigator.language ||
    (navigator as Navigator & { userLanguage?: string }).userLanguage ||
    "ko";
  return lang.toLowerCase().startsWith("ko") ? "ko" : "en";
}

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return isLocale(raw) ? raw : null;
}

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const prefix = `${AUTH_LOCALE_COOKIE}=`;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return isLocale(raw) ? raw : null;
}

type LocaleContextValue = {
  /** 현재 언어 (useState로 관리되는 단일 소스) */
  lang: Locale;
  setLang: (next: Locale) => void;
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (path: string) => string;
  messages: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    const initial = readStoredLocale() ?? readCookieLocale() ?? detectBrowserLocale();
    // Sync stored / browser language after mount (avoid SSR/localStorage mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time hydration sync
    setLocaleState(initial);
    document.documentElement.lang = initial === "ko" ? "ko" : "en";
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.cookie = `${AUTH_LOCALE_COOKIE}=${next}; Path=/; SameSite=Lax; Max-Age=31536000`;
    document.documentElement.lang = next === "ko" ? "ko" : "en";
  }, []);

  const value = useMemo(() => {
    const m = messages[locale];
    return {
      lang: locale,
      setLang: setLocale,
      locale,
      setLocale,
      messages: m,
      t: (path: string) => getMessage(m, path),
    };
  }, [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
