"use client";

import { LetterDownloadGate } from "@/components/letter-download-gate";
import { LanguageToggle } from "@/components/language-toggle";
import { SEASONAL_POLAROID_FRAME_BASE_CLASS, SeasonalPolaroidFrame } from "@/components/seasonal-polaroid-frame";
import { useAuthSession } from "@/components/use-auth-session";
import { useLocale } from "@/components/locale-provider";
import { fetchMyPolaroids, myPolaroidImageUrl, type SavedSeasonalPolaroid } from "@/lib/my-polaroids-client";
import { polaroidOccasionItem, polaroidThemeTitle } from "@/lib/polaroid-theme-catalog";
import { exportSeasonalPolaroidPng } from "@/lib/seasonal-polaroid-export";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function errorCopy(error: unknown, t: (path: string) => string): string {
  if (error instanceof Error && error.message === "authentication_required") return t("myPolaroids.authRequired");
  return t("myPolaroids.loadError");
}

function displayDate(value: string, lang: "ko" | "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(date);
}

function SavedPolaroidCard({ item, lang, t }: {
  item: SavedSeasonalPolaroid;
  lang: "ko" | "en";
  t: (path: string) => string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const imageUrl = myPolaroidImageUrl(item.resultId);
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const occasion = item.occasionId ? polaroidOccasionItem(item.occasionId) : undefined;
  const occasionTitle = occasion ? (lang === "ko" ? occasion.titleKo : occasion.titleEn) : null;

  const download = async () => {
    if (!frameRef.current || downloading || imageError) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      // Same composition and the same export path as the result page.
      const blob = await exportSeasonalPolaroidPng(frameRef.current);
      if (!blob) throw new Error("download_failed");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `soul-trace-${item.petName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "polaroid"}.png`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="rounded-2xl border border-[#D4AF37]/25 bg-[#17130f]/80 p-4 shadow-[0_20px_60px_rgba(0,0,0,.25)] sm:p-5">
      <SeasonalPolaroidFrame
        polaroidRef={frameRef}
        lang={lang}
        t={t}
        themeId={item.themeId}
        imageUrl={imageError ? null : imageUrl}
        imageAlt={t("myPolaroids.petImageAlt").replace("%NAME%", item.petName)}
        onImageError={() => setImageError(true)}
        memoLines={item.memoLines}
        showMemo
        placeholder={false}
        className={`${SEASONAL_POLAROID_FRAME_BASE_CLASS} mx-auto max-w-[440px]`}
        imageFallback={<div className="flex h-full w-full items-center justify-center bg-[#ded0bb] px-5 text-center text-xs text-[#806A56]">{t("myPolaroids.imageUnavailable")}</div>}
      />
      <div className={`mt-4 flex items-start justify-between gap-3 ${bodyFont}`}>
        <div className="min-w-0">
          <h2 className="truncate text-lg text-[#F3EAD8]">{item.petName}</h2>
          {item.petId ? <Link href={`/my/pets/${encodeURIComponent(item.petId)}`} className={`mt-1 inline-flex min-h-10 items-center text-xs text-[#EAC15A] underline-offset-4 hover:underline ${bodyFont}`}>{t("myPolaroids.openPetMemories")}</Link> : null}
          <p className="mt-1 text-xs text-[#B6AA99]">{item.themeId === "halloween" ? t("myPolaroids.halloween") : polaroidThemeTitle(item.themeId, lang) || item.themeId}{occasionTitle ? ` · ${occasionTitle}` : ""} · {displayDate(item.createdAt, lang)}</p>
        </div>
        <button type="button" onClick={download} disabled={downloading || imageError} className={`shrink-0 rounded-xl bg-[#B89A2E] px-3 py-2 text-xs font-medium text-black transition hover:bg-[#D0AE3D] disabled:cursor-not-allowed disabled:opacity-50 ${bodyFont}`}>
          {downloading ? t("myPolaroids.downloading") : t("myPolaroids.download")}
        </button>
      </div>
      {downloadError ? <p role="alert" className={`mt-2 text-xs text-red-200 ${bodyFont}`}>{t("myPolaroids.downloadError")}</p> : null}
    </article>
  );
}

export function MyPolaroidsPage() {
  const { t, lang } = useLocale();
  const { status: authStatus, email, refresh } = useAuthSession();
  const [items, setItems] = useState<SavedSeasonalPolaroid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [petFilter, setPetFilter] = useState("");
  const [pets, setPets] = useState<Array<{ petId: string; petName: string }>>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMyPolaroids(controller.signal, petFilter || null));
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorCopy(caught, t));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [petFilter, t]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (authStatus === "authenticated") void load();
  }, [authStatus, load]);
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    const controller = new AbortController();
    void fetch("/api/my/pets", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((body) => {
        if (Array.isArray(body?.pets)) {
          setPets(body.pets.flatMap((pet: { petId?: unknown; petName?: unknown }) =>
            typeof pet.petId === "string" && typeof pet.petName === "string" ? [{ petId: pet.petId, petName: pet.petName }] : [],
          ));
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [authStatus]);

  const openAuth = () => {
    setAuthOpen(true);
  };

  const onVerified = async (): Promise<"saved" | "save_failed"> => {
    await refresh();
    await load();
    setAuthOpen(false);
    return "saved";
  };

  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  return (
    <main className="min-h-[100svh] overflow-x-hidden bg-[#0d0b09] text-[#F3EAD8]">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 md:py-7">
        <Link href="/choose" className={`text-sm text-[#E8D6B4] underline-offset-4 hover:text-[#FFF4DE] hover:underline ${bodyFont}`}>{t("myPolaroids.back")}</Link>
        <div className="flex items-center gap-4"><span className="font-display-en text-[10px] uppercase tracking-[0.42em] text-[#EAC15A] sm:text-xs">SOUL TRACE</span><LanguageToggle /></div>
      </header>
      <section className="mx-auto w-full max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display-en text-[10px] uppercase tracking-[0.32em] text-[#D4AF37]">{t("myPolaroids.eyebrow")}</p>
          <h1 className={`mt-3 text-3xl font-light text-[#FFF0D0] sm:text-5xl ${bodyFont}`}>{t("myPolaroids.title")}</h1>
          <p className={`mt-3 text-sm leading-7 text-[#C9BDAE] ${bodyFont}`}>{t("myPolaroids.description")}</p>
        </div>
        {authStatus === "authenticated" && pets.length > 0 ? (
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-2">
            <label htmlFor="my-polaroids-pet-filter" className={`text-left text-xs text-[#C9BDAE] ${bodyFont}`}>{t("myPolaroids.petFilterLabel")}</label>
            <select id="my-polaroids-pet-filter" value={petFilter} onChange={(event) => setPetFilter(event.target.value)} className={`min-h-11 rounded-xl border border-[#D4AF37]/30 bg-[#17130f] px-3 text-sm text-[#F3EAD8] ${bodyFont}`}>
              <option value="">{t("myPolaroids.allPetsFilter")}</option>
              {pets.map((pet) => <option key={pet.petId} value={pet.petId}>{pet.petName}</option>)}
            </select>
          </div>
        ) : null}
        {authStatus === "loading" ? <p className={`mx-auto mt-12 text-center text-sm text-[#B6AA99] ${bodyFont}`}>{t("myPolaroids.loading")}</p> : null}
        {authStatus === "anonymous" ? <div className="mx-auto mt-12 max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#17130f]/80 p-7 text-center"><p className={`text-sm leading-7 text-[#E7D7BD] ${bodyFont}`}>{t("myPolaroids.authRequired")}</p><button type="button" onClick={openAuth} className={`mt-5 min-h-11 rounded-xl bg-[#B89A2E] px-6 py-3 text-sm font-medium text-black hover:bg-[#D0AE3D] ${bodyFont}`}>{t("myPolaroids.verifyEmail")}</button></div> : null}
        {authStatus === "authenticated" && loading ? <p className={`mx-auto mt-12 text-center text-sm text-[#B6AA99] ${bodyFont}`}>{t("myPolaroids.loading")}</p> : null}
        {error ? <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-red-300/25 bg-red-950/20 p-6 text-center"><p className={`text-sm leading-7 text-red-100 ${bodyFont}`}>{error}</p><button type="button" onClick={() => void load()} className={`mt-4 rounded-xl border border-[#D4AF37]/50 px-5 py-2 text-sm text-[#F0CF71] ${bodyFont}`}>{t("myPolaroids.retry")}</button></div> : null}
        {authStatus === "authenticated" && !loading && !error && items.length === 0 ? <p className={`mx-auto mt-12 max-w-md text-center text-sm leading-7 text-[#B6AA99] ${bodyFont}`}>{t("myPolaroids.empty")}</p> : null}
        {items.length > 0 ? <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{items.map((item) => <SavedPolaroidCard key={item.resultId} item={item} lang={lang} t={t} />)}</div> : null}
      </section>
      <LetterDownloadGate open={authOpen} purpose="seasonal-polaroid" pendingEmail={email} onClose={() => setAuthOpen(false)} onVerified={onVerified} />
    </main>
  );
}
