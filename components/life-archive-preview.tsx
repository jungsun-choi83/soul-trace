"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { TemporaryPhotoMoments } from "@/components/temporary-photo-moments";
import { TemporaryVideoMemories } from "@/components/temporary-video-memories";
import { useLocale } from "@/components/locale-provider";
import type { Locale } from "@/lib/i18n";
import { saveTemporaryLifeArchive } from "@/lib/life-archive-temporary";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

type ArchiveMemory = {
  memoryId: string;
  title: string | null;
  story: string;
  memoryDate: string | null;
  createdAt: string;
};

type ArchiveData = {
  archiveKey?: string;
  petName: string;
  letter: string;
  generationLocale: Locale;
  createdAt: string;
  soulTraceMemoryCount: number;
  archiveMemoryCount: number;
  memories: ArchiveMemory[];
};

type ArchiveStatus = "ready" | "loading" | "authentication-required" | "selection-required" | "error";

type LifeArchivePreviewProps = {
  status: ArchiveStatus;
  archive?: ArchiveData;
  storageMode?: "secure" | "temporary";
  accountPets?: Array<{
    petId: string;
    petName: string;
    letters: Array<{ submissionId: string; letterId: string; title: string | null; mode: string | null; channel: string | null; locale: Locale; createdAt: string }>;
  }>;
  selectedPetId?: string;
  selectedSubmissionId?: string;
  navigationOrigin?: "letter" | "choose";
  backHref?: string;
  archiveQuery?: string;
};

function exactLetterParagraphs(letter: string): string[] {
  return letter
    .split("[[ENDING_PHRASE]]", 1)[0]
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function LifeArchivePreview({
  status,
  archive,
  storageMode = "secure",
  accountPets = [],
  selectedPetId,
  selectedSubmissionId,
  navigationOrigin = "choose",
  backHref = "/choose",
  archiveQuery = "",
}: LifeArchivePreviewProps) {
  const { lang, t } = useLocale();
  const router = useRouter();
  const [fullLetterOpen, setFullLetterOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [memories, setMemories] = useState<ArchiveMemory[]>(archive?.memories ?? []);
  const [photoCounts, setPhotoCounts] = useState({ moments: 0, photos: 0, favorites: 0 });
  const [photoFormSignal, setPhotoFormSignal] = useState(0);
  const [videoFormOpen, setVideoFormOpen] = useState(false);
  const [selectedMemoryType, setSelectedMemoryType] = useState<"photos" | "video">("photos");
  const photoSectionRef = useRef<HTMLElement>(null);
  const photoHeadingRef = useRef<HTMLHeadingElement>(null);
  const videoSectionRef = useRef<HTMLElement>(null);
  const videoHeadingRef = useRef<HTMLHeadingElement>(null);
  const isKorean = lang === "ko";
  const paragraphs = useMemo(
    () => (archive ? exactLetterParagraphs(archive.letter) : []),
    [archive],
  );
  const archiveHref = (petId: string, submissionId?: string) => {
    const query = new URLSearchParams(archiveQuery);
    query.set("pet", petId);
    if (submissionId) query.set("letter", submissionId);
    return `/life-archive?${query.toString()}`;
  };

  const saveMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!story.trim() || saving) return;
    setSaving(true);
    setMemoryError(null);
    try {
      if (storageMode === "temporary" && archive?.archiveKey) {
        const memory: ArchiveMemory = {
          memoryId: crypto.randomUUID(),
          title: title.trim() ? title : null,
          story,
          memoryDate: memoryDate || null,
          createdAt: new Date().toISOString(),
        };
        const nextMemories = [memory, ...memories];
        setMemories(nextMemories);
        saveTemporaryLifeArchive({
          ...archive,
          archiveKey: archive.archiveKey,
          archiveMemoryCount: nextMemories.length,
          memories: nextMemories,
        });
        setTitle("");
        setStory("");
        setMemoryDate("");
        setFormOpen(false);
        return;
      }
      const response = await fetch("/api/life-archive/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: archive?.archiveKey, title, story, memoryDate }),
      });
      if (!response.ok) throw new Error("memory save failed");
      setTitle("");
      setStory("");
      setMemoryDate("");
      setFormOpen(false);
      router.refresh();
    } catch {
      setMemoryError(t("lifeArchive.memoryForm.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    if (deletingId || !window.confirm(t("lifeArchive.memoryForm.deleteConfirm"))) return;
    setDeletingId(memoryId);
    setMemoryError(null);
    try {
      if (storageMode === "temporary" && archive?.archiveKey) {
        const nextMemories = memories.filter((memory) => memory.memoryId !== memoryId);
        setMemories(nextMemories);
        saveTemporaryLifeArchive({
          ...archive,
          archiveKey: archive.archiveKey,
          archiveMemoryCount: nextMemories.length,
          memories: nextMemories,
        });
        return;
      }
      const response = await fetch("/api/life-archive/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: archive?.archiveKey, memoryId }),
      });
      if (!response.ok) throw new Error("memory delete failed");
      router.refresh();
    } catch {
      setMemoryError(t("lifeArchive.memoryForm.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const updatePhotoCounts = useCallback((moments: number, photos: number, favorites = 0) => {
    setPhotoCounts((current) =>
      current.moments === moments && current.photos === photos && current.favorites === favorites
        ? current
        : { moments, photos, favorites },
    );
  }, []);

  const scrollToMemorySection = (
    section: HTMLElement | null,
    heading: HTMLHeadingElement | null,
  ) => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      section?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      heading?.focus({ preventScroll: true });
    });
  };

  const openPhotoSection = () => {
    setSelectedMemoryType("photos");
    setPhotoFormSignal((value) => value + 1);
    scrollToMemorySection(photoSectionRef.current, photoHeadingRef.current);
  };

  const openVideoSection = () => {
    setSelectedMemoryType("video");
    setVideoFormOpen(true);
    scrollToMemorySection(videoSectionRef.current, videoHeadingRef.current);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-black text-[#F3EAD8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[68rem] select-none opacity-[0.17] sm:opacity-[0.27]"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, black 64%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 64%, transparent 100%)",
        }}
      >
        <Image
          src="/images/life-archive-pets-overlay.png"
          alt=""
          aria-hidden="true"
          width={1700}
          height={1000}
          priority
          className="h-auto w-full select-none object-contain brightness-110 saturate-125"
        />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-5 pb-16 pt-6 sm:px-8 md:pb-24 md:pt-8">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <Link
            href={backHref}
            className={`inline-flex min-h-11 items-center rounded-lg px-1 text-left text-sm font-light text-[#C4B8A8] transition hover:text-[#D4AF37] ${isKorean ? "font-ko" : "font-display-en"}`}
          >
            <span aria-hidden>← </span>{navigationOrigin === "letter" ? t("lifeArchive.back") : t("landing.navBack")}
          </Link>
          <LanguageToggle />
        </header>

        {status !== "ready" || !archive ? (
          <ArchiveUnavailable status={status} isKorean={isKorean} />
        ) : (
          <>
            <section className="mx-auto max-w-3xl pb-10 pt-14 text-center sm:pb-14 sm:pt-20">
              <p className="font-display-en text-[11px] font-medium uppercase tracking-[0.34em] text-[#D4AF37] sm:text-xs">FOUNDER&apos;S JOURNEY</p>
              <h1 className={`mt-5 text-[2rem] font-normal tracking-[0.08em] text-white sm:text-5xl sm:tracking-normal md:text-6xl ${isKorean ? "font-ko" : "font-display-en"}`}>
                {t("lifeArchive.title")}
              </h1>
              <p className={`mt-5 text-xl font-light text-[#F5E6C8] sm:text-2xl ${isKorean ? "font-ko" : "font-display-en"}`}>{archive.petName}</p>
              <p className={`mx-auto mt-6 max-w-2xl whitespace-pre-line text-sm font-extralight leading-[2] text-[#CFC5B6] sm:text-base ${isKorean ? "font-ko break-keep" : "font-display-en"}`}>
                {t("lifeArchive.introduction").replace(/%NAME%/g, archive.petName)}
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <button type="button" aria-pressed={selectedMemoryType === "photos"} onClick={openPhotoSection} className={`min-h-12 rounded-xl border px-6 py-3 text-sm font-light transition ${selectedMemoryType === "photos" ? "border-[#D4AF37] bg-[#b89a2e] text-black" : "border-[#D4AF37]/45 bg-black/45 text-[#F5E6C8] hover:bg-[#D4AF37]/10"} ${isKorean ? "font-ko" : "font-display-en"}`}>
                  + {t("lifeArchive.photos.add")}
                </button>
                <button type="button" aria-pressed={selectedMemoryType === "video"} onClick={openVideoSection} className={`min-h-12 rounded-xl border px-6 py-3 text-sm font-light transition ${selectedMemoryType === "video" ? "border-[#D4AF37] bg-[#b89a2e] text-black" : "border-[#D4AF37]/45 bg-black/45 text-[#F5E6C8] hover:bg-[#D4AF37]/10"} ${isKorean ? "font-ko" : "font-display-en"}`}>
                  + {t("lifeArchive.videos.add")}
                </button>
              </div>
            </section>

            <div className="space-y-8 sm:space-y-10">
              {storageMode === "secure" && accountPets.length ? (
                <nav aria-label={isKorean ? "내 반려동물과 편지" : "My pets and letters"} className="rounded-3xl border border-[#D4AF37]/25 bg-[#12100E]/80 p-5 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionLabel>{isKorean ? "내 반려동물" : "My Pets"}</SectionLabel>
                    {selectedPetId ? <a href={`/choose?petId=${encodeURIComponent(selectedPetId)}`} className="text-sm text-[#D4AF37] underline underline-offset-4">{isKorean ? "이 반려동물의 새 편지" : "New letter for this pet"}</a> : null}
                  </div>
                  <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
                    {accountPets.map((pet) => <a key={pet.petId} href={archiveHref(pet.petId)} aria-current={pet.petId === selectedPetId ? "page" : undefined} className={`min-h-11 shrink-0 rounded-full border px-4 py-2.5 text-sm ${pet.petId === selectedPetId ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5E6C8]" : "border-white/15 text-[#AFA598]"}`}>{pet.petName}</a>)}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {(accountPets.find((pet) => pet.petId === selectedPetId)?.letters ?? []).map((letter) => <a key={letter.submissionId} href={archiveHref(selectedPetId ?? "", letter.submissionId)} aria-current={letter.submissionId === selectedSubmissionId ? "page" : undefined} className={`rounded-xl border p-4 ${letter.submissionId === selectedSubmissionId ? "border-[#D4AF37]/70 bg-[#D4AF37]/10" : "border-white/10 bg-black/25"}`}><span className="block text-sm text-[#F3EAD8]">{letter.title || (isKorean ? "마음이 담긴 편지" : "A letter from the heart")}</span><span className="mt-1 block text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(letter.createdAt))}{letter.channel ? ` · ${letter.channel}` : letter.mode ? ` · ${letter.mode}` : ""}</span></a>)}
                  </div>
                </nav>
              ) : null}
              <section className={`rounded-3xl border border-[#D4AF37]/25 bg-[#12100E]/80 p-6 shadow-[0_0_50px_rgba(212,175,55,0.06)] sm:p-8 ${isKorean ? "font-ko" : "font-display-en"}`}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionLabel>{t("lifeArchive.archive.title")}</SectionLabel>
                  <p className="text-sm font-light text-[#D9C6A4]">
                    {photoCounts.moments} {t("lifeArchive.summary.photoMoments")} · {photoCounts.photos} {t("lifeArchive.summary.photos")} · {photoCounts.favorites} {t("lifeArchive.summary.favorites")}
                  </p>
                </div>
              </section>

              {archive.archiveKey ? (
                <>
                  <section id="life-archive-photo-upload" ref={photoSectionRef} aria-labelledby="life-archive-photo-upload-heading" className="scroll-mt-6">
                    <h2 id="life-archive-photo-upload-heading" ref={photoHeadingRef} tabIndex={-1} className="sr-only">{t("lifeArchive.photos.add")}</h2>
                    <TemporaryPhotoMoments
                      archiveKey={archive.archiveKey}
                      legacyMemories={memories}
                      onCountsChange={updatePhotoCounts}
                      onDeleteLegacy={deleteMemory}
                      openFormSignal={photoFormSignal}
                      showHeader={false}
                      latestOnly
                      showAllMemories
                      storageMode={storageMode}
                    />
                  </section>
                  <section id="life-archive-video-upload" ref={videoSectionRef} aria-labelledby="life-archive-video-upload-heading" className="scroll-mt-6">
                    <h2 id="life-archive-video-upload-heading" ref={videoHeadingRef} tabIndex={-1} className="sr-only">{t("lifeArchive.videos.add")}</h2>
                    <TemporaryVideoMemories archiveKey={archive.archiveKey} storageMode={storageMode} formOpen={videoFormOpen} onCloseForm={() => setVideoFormOpen(false)} />
                  </section>
                </>
              ) : null}

              <section className="grid gap-6 rounded-3xl border border-[#D4AF37]/25 bg-[#12100E]/80 p-6 shadow-[0_0_50px_rgba(212,175,55,0.06)] sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-8">
                <div className="lg:border-r lg:border-[#D4AF37]/25 lg:pr-8">
                  <SectionLabel>{t("lifeArchive.origin.label")}</SectionLabel>
                  <h2 className="mt-5 text-xl text-[#F5E6C8]">{t("lifeArchive.letter.title")}</h2>
                  <p className="mt-4 text-sm font-light leading-relaxed text-[#CFC5B6]">{t("lifeArchive.origin.createdFrom").replace("%COUNT%", String(archive.soulTraceMemoryCount))}</p>
                  <p className="mt-3 text-xs font-extralight text-[#8F8578]">
                    {new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "long" }).format(new Date(archive.createdAt))}
                  </p>
                </div>
                <div>
                  <div className="mt-6 border-l border-[#D4AF37]/35 pl-5 sm:pl-6">
                    {paragraphs.map((paragraph, index) => index === 0 || fullLetterOpen ? (
                      <p
                        key={`${index}-${paragraph.slice(0, 20)}`}
                        className={`${index > 0 ? "mt-5 border-t border-white/10 pt-5" : ""} text-[15px] font-normal leading-[1.9] text-[#EDE4D3] sm:text-base ${archive.generationLocale === "ko" ? "font-ko break-keep" : "font-display-en"}`}
                      >
                        {paragraph}
                      </p>
                    ) : null)}
                  </div>
                  {paragraphs.length > 1 ? (
                    <button
                      type="button"
                      aria-expanded={fullLetterOpen}
                      onClick={() => setFullLetterOpen((open) => !open)}
                      className={`mt-6 min-h-11 rounded-xl border border-[#D4AF37]/40 px-4 py-2.5 text-sm font-light text-[#F5E6C8] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 ${isKorean ? "font-ko" : "font-display-en"}`}
                    >
                      {fullLetterOpen ? t("lifeArchive.letter.closeFull") : t("lifeArchive.letter.readFull")}
                    </button>
                  ) : null}
                </div>
              </section>

              {storageMode !== "temporary" ? (
              <section className="rounded-3xl border border-[#D4AF37]/25 bg-[#0F0E0D]/90 p-6 shadow-[0_0_60px_rgba(212,175,55,0.06)] sm:p-8 md:p-10">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <SectionLabel>{t("lifeArchive.archive.title")}</SectionLabel>
                    <p className={`mt-2 text-sm font-light text-[#8F8578] ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.archive.count").replace("%COUNT%", String(memories.length))}</p>
                  </div>
                  <button
                    type="button"
                    aria-expanded={formOpen}
                    onClick={() => {
                      setFormOpen((open) => !open);
                      setMemoryError(null);
                    }}
                    className={`min-h-14 w-full rounded-xl bg-[#b89a2e] px-5 py-4 text-sm font-light text-black transition hover:bg-[#c9a934] sm:w-auto sm:min-w-48 sm:text-base ${isKorean ? "font-ko" : "font-display-en"}`}
                  >
                    <span aria-hidden>＋ </span>{t("lifeArchive.archive.add")}
                  </button>
                </div>

                {formOpen ? (
                  <form onSubmit={saveMemory} className={`mt-8 rounded-2xl border border-[#D4AF37]/25 bg-black/35 p-5 sm:p-7 ${isKorean ? "font-ko" : "font-display-en"}`}>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className="text-sm font-light text-[#D9C6A4]">
                        {t("lifeArchive.memoryForm.title")}
                        <input
                          type="text"
                          maxLength={160}
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder={t("lifeArchive.memoryForm.titlePlaceholder")}
                          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 text-[#F3EAD8] outline-none placeholder:text-[#6F675D] focus:border-[#D4AF37]/70"
                        />
                      </label>
                      <label className="text-sm font-light text-[#D9C6A4]">
                        {t("lifeArchive.memoryForm.date")}
                        <input
                          type="date"
                          value={memoryDate}
                          onChange={(event) => setMemoryDate(event.target.value)}
                          className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 text-[#F3EAD8] outline-none focus:border-[#D4AF37]/70"
                        />
                      </label>
                    </div>
                    <label className="mt-5 block text-sm font-light text-[#D9C6A4]">
                      {t("lifeArchive.memoryForm.story")}
                      <textarea
                        required
                        maxLength={10000}
                        rows={7}
                        value={story}
                        onChange={(event) => setStory(event.target.value)}
                        placeholder={t("lifeArchive.memoryForm.storyPlaceholder")}
                        className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 leading-[1.8] text-[#F3EAD8] outline-none placeholder:text-[#6F675D] focus:border-[#D4AF37]/70"
                      />
                    </label>
                    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                      <button type="button" onClick={() => setFormOpen(false)} className="min-h-12 rounded-xl border border-white/15 px-5 py-3 text-sm text-[#C4B8A8] hover:border-white/30">
                        {t("lifeArchive.memoryForm.cancel")}
                      </button>
                      <button type="submit" disabled={saving || !story.trim()} className="min-h-12 rounded-xl bg-[#b89a2e] px-6 py-3 text-sm text-black transition hover:bg-[#c9a934] disabled:cursor-not-allowed disabled:opacity-45">
                        {saving ? t("lifeArchive.memoryForm.saving") : t("lifeArchive.memoryForm.save")}
                      </button>
                    </div>
                  </form>
                ) : null}

                {memoryError ? <p role="alert" className={`mt-5 text-sm text-red-200 ${isKorean ? "font-ko" : "font-display-en"}`}>{memoryError}</p> : null}

                {memories.length === 0 ? (
                  <div className="mt-8 rounded-2xl border border-dashed border-[#D4AF37]/20 bg-black/25 px-5 py-12 text-center sm:px-8 sm:py-16">
                    <div className="mx-auto h-px w-12 bg-[#D4AF37]/55" aria-hidden />
                    <h3 className={`mt-6 text-lg font-light text-[#F3EAD8] sm:text-xl ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.empty.title")}</h3>
                    <p className={`mx-auto mt-4 max-w-xl whitespace-pre-line text-sm font-extralight leading-[1.9] text-[#AFA598] sm:text-base ${isKorean ? "font-ko break-keep" : "font-display-en"}`}>{t("lifeArchive.empty.body")}</p>
                  </div>
                ) : (
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {memories.map((memory) => (
                      <article key={memory.memoryId} className="rounded-2xl border border-white/10 bg-black/35 p-5 sm:p-6">
                        <p className="font-display-en text-xs tracking-[0.04em] text-[#A99B87]">
                          {new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "long" }).format(new Date(`${memory.memoryDate ?? memory.createdAt.slice(0, 10)}T00:00:00`))}
                        </p>
                        {memory.title ? <h3 className="font-display-en mt-3 text-xl text-[#F5E6C8]">{memory.title}</h3> : null}
                        <p className="font-display-en mt-4 whitespace-pre-wrap text-sm font-normal leading-[1.85] text-[#CFC5B6]">{memory.story}</p>
                        <button
                          type="button"
                          disabled={deletingId === memory.memoryId}
                          onClick={() => deleteMemory(memory.memoryId)}
                          className={`mt-5 min-h-11 text-xs font-light text-[#8F8578] underline decoration-white/20 underline-offset-4 transition hover:text-red-200 disabled:opacity-45 ${isKorean ? "font-ko" : "font-display-en"}`}
                        >
                          {deletingId === memory.memoryId ? t("lifeArchive.memoryForm.deleting") : t("lifeArchive.memoryForm.delete")}
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              ) : null}
            </div>
            <footer className={`mt-14 border-t border-white/10 pt-6 text-center text-xs font-light text-[#8F8578] ${isKorean ? "font-ko" : "font-display-en"}`}>
              <p>{t("lifeArchive.footer.privacy")}</p>
              <p className="mt-2 tracking-[0.24em] text-[#A99B87]">SOUL TRACE</p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

function ArchiveUnavailable({ status, isKorean }: { status: ArchiveStatus; isKorean: boolean }) {
  const { t } = useLocale();
  if (status === "loading") {
    return (
      <section aria-live="polite" className={`mx-auto mt-24 max-w-2xl px-6 py-14 text-center ${isKorean ? "font-ko" : "font-display-en"}`}>
        <p className="text-sm font-light text-[#D9C6A4]">{t("lifeArchive.loading")}</p>
      </section>
    );
  }
  const key = status === "authentication-required" ? "authenticationRequired" : status === "selection-required" ? "selectionRequired" : "error";
  return (
    <section role="alert" className={`mx-auto mt-24 max-w-2xl rounded-3xl border border-[#D4AF37]/20 bg-[#12100E]/80 px-6 py-14 text-center ${isKorean ? "font-ko" : "font-display-en"}`}>
      <h1 className="text-2xl font-light text-[#F3EAD8]">{t(`lifeArchive.${key}.title`)}</h1>
      <p className="mt-4 whitespace-pre-line text-sm font-extralight leading-[1.9] text-[#AFA598] sm:text-base">{t(`lifeArchive.${key}.body`)}</p>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display-en text-[11px] font-medium uppercase tracking-[0.26em] text-[#D4AF37] sm:text-xs">{children}</h2>;
}

// Kept for compatibility with older saved layouts; the front page now presents a compact summary.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function JourneyRow({ label, complete = false }: { label: string; complete?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm font-extralight leading-relaxed text-[#D8CFC1] sm:text-base">
      <span className={complete ? "text-[#D4AF37]" : "text-[#6F675D]"} aria-hidden>{complete ? "●" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}
