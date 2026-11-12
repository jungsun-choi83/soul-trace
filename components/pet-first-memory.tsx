"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel, storyTabProps } from "@/components/pet-first-home";
import { StatusPill, StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryScene } from "@/components/storybook/story-scene";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import { validatePhotoFiles } from "@/lib/pet-first-archive";
import { fetchOrNull, jsonOrNull, requestFailed } from "@/lib/network-failure";
import { readOriginalCaptureDate } from "@/lib/photo-capture-date";
import { resolvePhotoBatchDates } from "@/lib/photo-batch";
import {
  beamSceneHref,
  flattenYearFoldersNewestFirst,
  groupLibraryIntoYearFolders,
  isMoodJournalItem,
  letterHrefForPet,
  memorialSpaceHref,
  moodJournalHref,
  monthFolderCoverUrl,
  polaroidHrefFromArchive,
  type MemoryLibraryItem,
  type YearMonthFolder,
} from "@/lib/memory-library";
import {
  describeMemoryDate,
  isSameDayLastYear,
  letterPathForLifeStatus,
  petFirstCopy,
  timelineDay,
  timelineMonthKey,
} from "@/lib/pet-first-archive";
import { fill, folderMemoryCount, type PetFirstCopy } from "@/lib/storybook-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type UIEvent as ReactUIEvent } from "react";

type TimelineItem = MemoryLibraryItem;
type ComposeMode = "photo" | "video" | "story";
type PhotoCaptureMetadata = string | null;
export type PetFirstMemoryView = "album" | "record" | "detail";

function withoutEmptyFiles(data: FormData) {
  const next = new FormData();
  for (const [key, value] of data.entries()) {
    if (value instanceof File && value.size === 0) continue;
    next.append(key, value);
  }
  return next;
}

export function PetFirstMemory({
  profile,
  today,
  view = "album",
  entryId,
  returnPane = "album",
  folderKey = null,
}: {
  profile: PetProfile;
  today: string;
  view?: PetFirstMemoryView;
  entryId?: string | null;
  returnPane?: "album" | "collection" | "together";
  folderKey?: string | null;
}) {
  const { lang } = useLocale();
  const router = useRouter();
  const copy = petFirstCopy(lang);
  const petId = profile.petId;
  const petName = profile.petName;
  const albumHref = `/my/pets/${encodeURIComponent(petId)}/memories`;
  const [status, setStatus] = useState(profile.lifeStatus);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [albumScope, setAlbumScope] = useState<AlbumScope>("all");
  const [mode, setMode] = useState<ComposeMode>("photo");
  const [chosen, setChosen] = useState(0);
  const [photoCaptureMetadata, setPhotoCaptureMetadata] = useState<PhotoCaptureMetadata[]>([]);
  const [photoScanning, setPhotoScanning] = useState(false);
  const [photoSelectionError, setPhotoSelectionError] = useState(false);
  const [camera, setCamera] = useState<"photo" | "video" | null>(null);
  const recordDirty = useRef(false);
  const photoScanId = useRef(0);
  const photoForm = useRef<HTMLFormElement>(null);
  const videoForm = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const response = await fetchOrNull(`/api/my/pets/${petId}/memories`);
    const body = await jsonOrNull<{ timeline?: TimelineItem[] }>(response);
    setLoading(false);
    if (requestFailed(response) || !body) {
      setLoadError(true);
      return;
    }
    setTimeline((body.timeline ?? []).map((item) => ({
      ...item,
      place: item.place ?? null,
      favorite: Boolean(item.favorite),
    })));
  }, [petId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (view !== "album") return;
    // The saved flag is read from the URL once after mount. Reading it during
    // render would differ between the server and the client, so the notice is
    // raised from a callback rather than synchronously in the effect body.
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const saved = params.get("saved");
      if (!saved) return;
      setNotice(saved === "first" ? copy.savedFirst : copy.saved);
      params.delete("saved");
      const query = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [copy.saved, copy.savedFirst, view]);

  function begin() {
    setSaving(true);
    setSaveError(false);
    setNotice(null);
  }

  function finish(form: HTMLFormElement, wasEmpty: boolean) {
    form.reset();
    photoScanId.current += 1;
    recordDirty.current = false;
    setChosen(0);
    setPhotoCaptureMetadata([]);
    setPhotoScanning(false);
    setPhotoSelectionError(false);
    router.push(`${albumHref}?saved=${wasEmpty ? "first" : "1"}#album`);
  }

  function confirmUnsavedRecordNavigation(event: ReactMouseEvent<HTMLDivElement>) {
    if (view !== "record" || !recordDirty.current || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-record-draft-action]")) return;
    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!link || link.target === "_blank" || new URL(link.href).href === window.location.href) return;
    if (!window.confirm(copy.unsavedRecordConfirm)) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function changeComposeMode(nextMode: ComposeMode) {
    if (nextMode === mode) return;
    if (recordDirty.current && !window.confirm(copy.unsavedRecordConfirm)) return;
    recordDirty.current = false;
    photoScanId.current += 1;
    setMode(nextMode);
    setChosen(0);
    setPhotoCaptureMetadata([]);
    setPhotoScanning(false);
    setPhotoSelectionError(false);
  }

  async function postPhoto(form: HTMLFormElement, data: FormData) {
    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) {
      setSaveError(true);
      return;
    }
    const wasEmpty = timeline.length === 0;
    begin();
    const response = await fetchOrNull(`/api/my/pets/${petId}/photos`, { method: "POST", body: data });
    setSaving(false);
    if (requestFailed(response)) {
      setSaveError(true);
      return;
    }
    finish(form, wasEmpty);
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The submit button is disabled while saving; this also blocks a repeat
    // submit raised programmatically or by a keyboard race.
    if (saving || photoScanning || photoSelectionError) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = formData.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) {
      setSaveError(true);
      return;
    }
    const optionalDate = String(formData.get("memoryDate") ?? "");
    const data = withoutEmptyFiles(formData);
    data.delete("photoDates");
    const detectedDates = files.map((_, index) => photoCaptureMetadata[index] ?? null);
    for (const date of resolvePhotoBatchDates(files, detectedDates, optionalDate)) {
      data.append("photoDates", date);
    }
    await postPhoto(form, data);
  }

  function selectPhotoFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    const scanId = ++photoScanId.current;
    const validSelection = validatePhotoFiles(selected) === "ok";
    setPhotoCaptureMetadata(selected.map(() => null));
    setChosen(selected.length);
    setPhotoSelectionError(!validSelection);
    recordDirty.current = recordDirty.current || selected.length > 0;
    setPhotoScanning(Boolean(selected.length && validSelection));
    if (!selected.length || !validSelection) return;

    void (async () => {
      const detectedDates = await Promise.all(selected.map((file) => readOriginalCaptureDate(file)));
      if (photoScanId.current !== scanId) return;
      setPhotoCaptureMetadata(detectedDates);
      setPhotoScanning(false);
    })();
  }

  async function saveStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const wasEmpty = timeline.length === 0;
    begin();
    const response = await fetchOrNull(`/api/my/pets/${petId}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        story: data.get("story"),
        title: data.get("title"),
        happenedOn: data.get("memoryDate"),
      }),
    });
    setSaving(false);
    if (requestFailed(response)) {
      setSaveError(true);
      return;
    }
    finish(form, wasEmpty);
  }

  async function postVideo(form: HTMLFormElement, data: FormData, knownDuration?: number) {
    const file = data.get("video");
    if (!(file instanceof File) || file.size === 0) {
      setSaveError(true);
      return;
    }
    begin();
    try {
      const duration = knownDuration ?? await videoDuration(file);
      data.set("duration", String(duration));
    } catch {
      setSaving(false);
      setSaveError(true);
      return;
    }
    const wasEmpty = timeline.length === 0;
    const response = await fetchOrNull(`/api/my/pets/${petId}/videos`, { method: "POST", body: data });
    setSaving(false);
    if (requestFailed(response)) {
      setSaveError(true);
      return;
    }
    finish(form, wasEmpty);
  }

  async function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    await postVideo(form, withoutEmptyFiles(new FormData(form)));
  }

  function uploadCapturedPhoto(file: File) {
    const form = photoForm.current;
    if (!form) return;
    const data = withoutEmptyFiles(new FormData(form));
    data.delete("photos");
    data.append("photos", file);
    setCamera(null);
    void postPhoto(form, data);
  }

  function uploadCapturedVideo(file: File, durationSeconds: number) {
    const form = videoForm.current;
    if (!form) return;
    const data = withoutEmptyFiles(new FormData(form));
    data.delete("video");
    data.append("video", file);
    setCamera(null);
    void postVideo(form, data, durationSeconds);
  }

  async function remove(entryId: string) {
    if (!window.confirm(copy.deleteConfirm)) return;
    setSaveError(false);
    const response = await fetchOrNull(`/api/my/pets/${petId}/memories`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    if (requestFailed(response)) {
      setSaveError(true);
      return;
    }
    setTimeline((current) => current.filter((item) => item.entryId !== entryId));
    if (view === "detail") router.replace(`${albumHref}?pane=${returnPane}${folderKey ? `&folder=${encodeURIComponent(folderKey)}` : ""}#album`);
  }

  async function patchMemory(entryId: string, patch: { title?: string | null; story?: string | null; place?: string | null; happenedOn?: string | null; favorite?: boolean }) {
    setSaveError(false);
    const response = await fetchOrNull(`/api/my/pets/${petId}/memories`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId, ...patch }),
    });
    if (requestFailed(response)) {
      setSaveError(true);
      return;
    }
    const currentItem = timeline.find((item) => item.entryId === entryId);
    setTimeline((current) => current.map((item) => (item.entryId === entryId ? { ...item, ...patch } : item)));
    if (view === "detail" && currentItem && Object.prototype.hasOwnProperty.call(patch, "happenedOn")) {
      const nextFolder = timelineMonthKey({ happenedOn: patch.happenedOn ?? null, createdAt: currentItem.createdAt });
      router.replace(`${albumHref}?entry=${encodeURIComponent(entryId)}&pane=${returnPane}&folder=${nextFolder}#album`);
    }
    setNotice(copy.saved);
  }

  const memorial = status === "memorial";
  const album = timeline.filter((item) => !isMoodJournalItem(item));
  const lastYear = album.filter((item) => isSameDayLastYear(item, today));
  const yearFolders = groupLibraryIntoYearFolders(album);
  const monthFolders = flattenYearFoldersNewestFirst(yearFolders);
  // Album scope reads the years the existing grouping already produced; no new
  // date handling happens here.
  const thisYearKey = today.slice(0, 4);
  const lastYearKey = String(Number(thisYearKey) - 1);
  const inScope = (year: string, scope: AlbumScope) => scope === "all"
    || (scope === "thisYear" && year === thisYearKey)
    || (scope === "lastYear" && year === lastYearKey)
    || (scope === "others" && year !== thisYearKey && year !== lastYearKey);
  const scopedMonths = monthFolders.filter((folder) => inScope(folder.year, albumScope));
  const scopeTotal = (scope: AlbumScope) => yearFolders
    .filter((entry) => inScope(entry.year, scope))
    .reduce((total, entry) => total + entry.months.reduce((sum, month) => sum + month.count, 0), 0);
  const selectedFolder = folderKey
    ? monthFolders.find((folder) => folder.key === folderKey) ?? null
    : null;
  const favorites = album.filter((item) => item.favorite);
  const selectedItem = entryId ? album.find((item) => item.entryId === entryId) ?? null : null;
  const currentSection = view === "record" ? "record" : returnPane;
  const sectionTabs = [
    { id: "album", label: copy.albumTitle, href: `${albumHref}#album` },
    { id: "record", label: copy.memoryTabRecord, href: `${albumHref}/record` },
    { id: "collection", label: copy.memoryTabCollection, href: `${albumHref}?pane=collection#album` },
    { id: "together", label: copy.memoryTabTogether, href: `${albumHref}?pane=together#album` },
  ] as const;

  return (
    <div onClickCapture={confirmUnsavedRecordNavigation} className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader
          backHref={view === "album" ? `/my/pets/${encodeURIComponent(petId)}` : view === "detail" ? `${albumHref}?pane=${returnPane}${folderKey ? `&folder=${encodeURIComponent(folderKey)}` : ""}#album` : `${albumHref}#album`}
          backLabel={view === "album" ? copy.tabs.pet : copy.albumTitle}
          settingsHref="/settings"
          settingsLabel={copy.settingsTitle}
        />
        <section className="st-rise mt-5" aria-labelledby="memory-page-title">
          <h1 id="memory-page-title" className="st-headline text-2xl">{petName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusPill tone={status === "living" ? "living" : "quiet"}>{statusLabel(copy, status)}</StatusPill>
            {profile.species ? <p className="text-sm text-[color:var(--st-text-soft)]">{profile.species}</p> : null}
          </div>
          <h2 className="st-headline mt-4 text-2xl">{view === "record" ? copy.composeTitle : copy.albumTitle}</h2>
        </section>

        <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label={copy.tabs.memories}>
          {sectionTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={currentSection === tab.id}
              aria-current={currentSection === tab.id ? "page" : undefined}
              className={`st-btn min-h-11 px-2 text-center text-sm ${currentSection === tab.id ? "st-btn-sage" : "st-btn-quiet"}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        {view === "album" ? (
          <>
            <p className="st-eyebrow mt-6">{currentSection === "together" ? (memorial ? copy.memorialTogetherEyebrow : copy.togetherEyebrow) : currentSection === "collection" ? (memorial ? copy.memorialCollectionEyebrow : copy.collectionEyebrow) : (memorial ? copy.memorialArchiveEyebrow : copy.archiveEyebrow)}</p>
            <h2 className="st-headline mt-2 text-2xl">{currentSection === "together" ? (memorial ? copy.memorialTogetherTitle : copy.togetherTitle) : currentSection === "collection" ? (memorial ? copy.memorialCollectionTitle : copy.collectionTitle) : fill(memorial ? copy.memorialArchiveTitle : copy.archiveTitle, { NAME: petName })}</h2>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{currentSection === "together" ? (memorial ? copy.memorialTogetherBody : fill(copy.togetherBody, { NAME: petName })) : currentSection === "collection" ? (memorial ? copy.memorialCollectionBody : copy.collectionBody) : (memorial ? copy.memorialArchiveBody : copy.archiveBody)}</p>
          </>
        ) : null}

        {view === "album" && currentSection === "together" ? (
          <section className="mt-6 space-y-3">
            {status === "living" ? (
              <>
                <article className="st-card overflow-hidden">
                  <StoryScene scene="livingroom" className="rounded-none" />
                  <div className="px-5 py-4">
                    <p className="font-medium">{copy.familySpaceTitle}</p>
                    <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.familySpaceBody}</p>
                    <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.plannedFamily}</p>
                    <span className="mt-3 inline-flex rounded-full bg-[color:var(--st-beige)] px-2.5 py-1 text-xs">{copy.soon}</span>
                  </div>
                </article>
                <article className="st-card px-5 py-4">
                  <p className="font-medium">{copy.togetherThings}</p>
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[color:var(--st-text-soft)]">
                    <li>{copy.familyList1}</li>
                    <li>{copy.familyList2}</li>
                    <li>{copy.familyList3}</li>
                  </ul>
                </article>
                <article className="st-card px-5 py-4">
                  <p className="font-medium">{copy.specialResults}</p>
                  <Link href={letterPathForLifeStatus(status, petId)} className="st-btn st-btn-quiet mt-3 w-full">{copy.togetherLetter}</Link>
                </article>
              </>
            ) : null}
            {status === "memorial" ? (
              <div className="grid gap-3">
                <TogetherCard scene="memorial" title={fill(copy.memorialHallTitle, { NAME: petName })} body={copy.memorialHallBody} href={memorialSpaceHref(petId)} />
                <TogetherCard scene="letter" title={copy.moodTitle} body={copy.moodBody} href={moodJournalHref(petId)} />
                <TogetherCard scene="home" title={copy.familyMessageTitle} body={copy.familyMessageBody} soon={copy.soon} note={copy.plannedFamily} />
              </div>
            ) : null}
            {status === "unspecified" ? (
              <div className="st-card px-5 py-5">
                <p className="font-medium">{copy.branchTitle}</p>
                <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.branchBody}</p>
                <Link href="/dashboard" className="st-btn st-btn-primary mt-4 w-full">{copy.tabs.home}</Link>
              </div>
            ) : null}
          </section>
        ) : null}

        {view === "album" && currentSection === "collection" ? (
          <section className="mt-6">
            <h3 className="st-headline text-lg">{copy.favoriteScenes}</h3>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.plannedFavorites}</p>
            {!favorites.length ? <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.favoriteEmpty}</p> : null}
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {favorites.map((item) => (
                <li key={item.entryId}>
                  <MemoryCard item={item} petName={petName} copy={copy} href={`${albumHref}?entry=${encodeURIComponent(item.entryId)}&pane=collection#album`} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {view === "record" && memorial ? (
          <MemorialRoom copy={copy} letterCount={profile.letterCount} letterHref={`/life-archive?pet=${encodeURIComponent(petId)}`} saving={saving} onSave={saveStory} />
        ) : null}

        {view === "record" ? <>
        <section id="compose" onChangeCapture={() => { recordDirty.current = true; }} className="mt-5 scroll-mt-6" aria-labelledby="compose-title">
          <p className="st-eyebrow">{copy.memoryTabRecord}</p>
          <h2 id="compose-title" className="st-headline text-2xl">{copy.composeTitle}</h2>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.composeBody}</p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={copy.composeTitle}>
            {(["photo", "video", "story"] as ComposeMode[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => changeComposeMode(value)}
                className={`st-btn min-h-12 px-2 text-[0.8rem] leading-tight ${mode === value ? "st-btn-sage" : "st-btn-quiet"}`}
              >
                {value === "photo" ? copy.photoTab : value === "video" ? copy.videoTab : copy.storyTab}
              </button>
            ))}
          </div>

          <div className="st-card mt-4 px-5 py-5">
            {mode === "photo" ? (
              <form ref={photoForm} onSubmit={savePhoto} className="space-y-4" aria-busy={saving}>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="st-file min-h-24" onClick={() => setCamera("photo")}>
                    <PictureMark />
                    <span className="font-medium">{copy.photoCapture}</span>
                  </button>
                  <label htmlFor="pet-photo" className="st-file min-h-24">
                    <PictureMark />
                    <span className="font-medium">{chosen ? fill(copy.filesChosen, { COUNT: chosen }) : copy.photoLibrary}</span>
                    <input
                      id="pet-photo"
                      name="photos"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onClick={(event) => {
                        if (photoCaptureMetadata.length && recordDirty.current && !window.confirm(copy.unsavedRecordConfirm)) {
                          event.preventDefault();
                          event.stopPropagation();
                        }
                      }}
                      onChange={(event) => selectPhotoFiles(event.currentTarget.files)}
                    />
                  </label>
                </div>
                <p className="text-xs text-[color:var(--st-text-soft)]">{copy.photoHint}</p>
                {photoSelectionError ? <p role="alert" className="text-sm text-[#8a4b32]">{copy.photoSelectionError}</p> : null}
                {photoScanning ? <p role="status" className="text-xs text-[color:var(--st-text-soft)]">{copy.sortingPhotos}</p> : null}
                <TextLine id="photo-caption" name="caption" label={copy.captionLabel} placeholder={copy.captionPlaceholder} optional={copy.optional} />
                <TextLine id="photo-place" name="place" label={copy.placeLabel} placeholder={copy.placePlaceholder} optional={copy.optional} />
                <DateField id="photo-date" copy={copy} />
                <p className="text-xs text-[color:var(--st-text-soft)]">{copy.webUploadOnly}</p>
                <SubmitButton saving={saving} disabled={photoScanning || photoSelectionError} copy={copy} label={copy.savePhoto} />
              </form>
            ) : null}
            {mode === "video" ? (
              <form ref={videoForm} onSubmit={saveVideo} className="space-y-4" aria-busy={saving}>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className="st-file min-h-24" onClick={() => setCamera("video")}>
                    <PictureMark video />
                    <span className="font-medium">{copy.videoCapture}</span>
                  </button>
                  <button type="button" className="st-file min-h-24" onClick={() => setCamera("video")}>
                    <PictureMark video />
                    <span className="font-medium">{copy.videoLibrary}</span>
                  </button>
                </div>
                <label htmlFor="pet-video" className="st-btn st-btn-quiet w-full">
                  {chosen ? fill(copy.filesChosen, { COUNT: chosen }) : copy.photoLibrary}
                  <input id="pet-video" name="video" type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(event) => setChosen(event.currentTarget.files?.length ?? 0)} />
                </label>
                <p className="text-xs text-[color:var(--st-text-soft)]">{copy.videoHint}</p>
                <TextLine id="video-caption" name="caption" label={copy.captionLabel} placeholder={copy.captionPlaceholder} optional={copy.optional} />
                <DateField id="video-date" copy={copy} />
                <SubmitButton saving={saving} copy={copy} label={copy.saveVideo} />
              </form>
            ) : null}
            {mode === "story" ? (
              <form onSubmit={saveStory} className="space-y-4" aria-busy={saving}>
                <TextLine id="story-title" name="title" label={copy.captionLabel} placeholder={copy.captionPlaceholder} optional={copy.optional} />
                <div>
                  <label htmlFor="story-body" className="mb-1.5 block text-sm font-medium">{copy.storyLabel}</label>
                  <textarea id="story-body" name="story" required maxLength={2000} rows={5} placeholder={copy.storyPlaceholder} className="st-field" />
                </div>
                <DateField id="story-date" copy={copy} />
                <SubmitButton saving={saving} copy={copy} label={copy.saveStory} />
              </form>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.humanNote} {copy.noPayment}</p>
        </section>
        {camera ? (
          <LiveCamera
            mode={camera}
            copy={copy}
            onClose={() => setCamera(null)}
            onPhoto={uploadCapturedPhoto}
            onVideo={uploadCapturedVideo}
          />
        ) : null}

        <div className="mt-4 space-y-3" aria-live="polite">
          {notice ? <StoryState kind="success" title={notice} /> : null}
          {saveError ? <StoryState kind="error" title={copy.saveError} /> : null}
        </div>
        </> : null}

        {view === "album" && currentSection === "album" ? <>
        {lastYear.length && !folderKey ? (
          <section className="mt-12" aria-labelledby="last-year-title">
            <h2 id="last-year-title" className="st-headline text-2xl">{copy.lastYear}</h2>
            <ul className="mt-4 space-y-4">
              {lastYear.map((item) => <li key={`ly-${item.origin}-${item.entryId}`}><MemoryCard item={item} petName={petName} copy={copy} href={`${albumHref}?entry=${encodeURIComponent(item.entryId)}&pane=album&folder=${timelineMonthKey(item)}#album`} /></li>)}
            </ul>
          </section>
        ) : null}

        <section id="album" className="mt-12 scroll-mt-6" aria-labelledby="album-title" aria-busy={loading}>
          <h2 id="album-title" className="st-headline text-2xl">{selectedFolder ? monthLabel(selectedFolder.key, lang) : copy.foldersTitle}</h2>
          <div className="mt-4">
            {loading ? <StoryState kind="loading" title={copy.loading} /> : null}
            {loadError ? (
              <StoryState
                kind="error"
                title={copy.loadError}
                action={<button type="button" onClick={() => void load()} className="st-btn st-btn-quiet">{copy.retry}</button>}
              />
            ) : null}
            {!loading && !loadError && album.length === 0 ? (
              <StoryState
                kind="empty"
                scene="timeline"
                title={copy.albumEmpty}
                action={<Link href={`${albumHref}/record`} className="st-btn st-btn-primary">{copy.todayCta}</Link>}
              />
            ) : null}
          </div>
          {!loading && !loadError && !folderKey ? (
            <AlbumFolderBrowser
              months={scopedMonths}
              albumHref={albumHref}
              copy={copy}
              lang={lang}
              scope={albumScope}
              onScopeChange={setAlbumScope}
              totals={{
                all: scopeTotal("all"),
                thisYear: scopeTotal("thisYear"),
                lastYear: scopeTotal("lastYear"),
                others: scopeTotal("others"),
              }}
              thisYearKey={thisYearKey}
              lastYearKey={lastYearKey}
            />
          ) : null}
          {folderKey ? (
            <>
              <Link href={`${albumHref}#album`} className="st-link mt-3 inline-flex min-h-11 items-center text-sm">← {copy.backToFolders}</Link>
              {selectedFolder ? <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{folderMemoryCount(lang, selectedFolder.count)}</p> : null}
              {!loading && !loadError && (!selectedFolder || selectedFolder.count === 0) ? (
                <StoryState kind="empty" scene="timeline" title={copy.albumEmpty} action={<Link href={`${albumHref}/record`} className="st-btn st-btn-primary">{copy.todayCta}</Link>} />
              ) : null}
              {selectedFolder?.days.map((day) => (
                <div key={day.key} className="mt-5">
                  <h3 className="st-pen text-xl text-[color:var(--st-brown)]">{day.key} · {day.items.length}</h3>
                  <ul className="mt-2 grid gap-3">
                    {day.items.map((item) => <li key={`${item.origin}-${item.entryId}`}><MemoryCard item={item} petName={petName} copy={copy} href={`${albumHref}?entry=${encodeURIComponent(item.entryId)}&pane=album&folder=${selectedFolder.key}#album`} /></li>)}
                  </ul>
                </div>
              ))}
            </>
          ) : null}
        </section>
        </> : null}

        {view === "detail" ? (
          <section id="album" className="mt-5 scroll-mt-6" aria-busy={loading}>
            {loading ? <StoryState kind="loading" title={copy.loading} /> : null}
            {loadError ? <StoryState kind="error" title={copy.loadError} action={<button type="button" onClick={() => void load()} className="st-btn st-btn-quiet">{copy.retry}</button>} /> : null}
            {!loading && !loadError && !selectedItem ? <StoryState kind="empty" title={copy.albumEmpty} action={<Link href={`${albumHref}?pane=${returnPane}${folderKey ? `&folder=${encodeURIComponent(folderKey)}` : ""}#album`} className="st-btn st-btn-quiet">{copy.backToFolders}</Link>} /> : null}
            {selectedItem ? <ul className="mt-3"><AlbumEntry item={selectedItem} copy={copy} petName={petName} letterHref={letterHrefForPet(status, petId)} polaroidHref={polaroidHrefFromArchive(petId, selectedItem.entryId, selectedItem.assets.find((asset) => asset.contentType.startsWith("image/"))?.assetId)} beamHref={beamSceneHref(petId, selectedItem.entryId, selectedItem.assets[0]?.assetId)} onRemove={selectedItem.deletable ? () => void remove(selectedItem.entryId) : undefined} onPatch={selectedItem.deletable ? (patch) => void patchMemory(selectedItem.entryId, patch) : undefined} /></ul> : null}
            {notice ? <div className="mt-3"><StoryState kind="success" title={notice} /></div> : null}
            {saveError ? <div className="mt-3"><StoryState kind="error" title={copy.saveError} /></div> : null}
          </section>
        ) : null}
      </main>

      <StoryTabbar current="memories" {...storyTabProps(copy, petId, true, status)} />
    </div>
  );
}

function MemorialRoom({
  copy,
  letterCount,
  letterHref,
  saving,
  onSave,
}: {
  copy: PetFirstCopy;
  letterCount: number;
  letterHref: string;
  saving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section id="memorial" className="st-card mt-10 scroll-mt-6 overflow-hidden" aria-labelledby="memorial-title">
      <div className="bg-[color:var(--st-rose-soft)]/40 px-5 py-6 sm:px-7">
        <p className="st-eyebrow">{copy.memorialEyebrow}</p>
        <h2 id="memorial-title" className="st-headline mt-2 text-2xl">{copy.memorialTitle}</h2>
        <p className="mt-2 text-sm">{copy.memorialBody}</p>
        <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.memorialQuiet}</p>
        {letterCount > 0 ? <Link href={letterHref} className="st-btn st-btn-quiet mt-4">{copy.rereadLetter}</Link> : null}
      </div>
      <form onSubmit={onSave} className="space-y-3 px-5 py-5 sm:px-7" aria-busy={saving}>
        <label htmlFor="heart-body" className="flex items-baseline justify-between gap-3 text-sm font-medium">
          {copy.heartTitle}
          <span className="text-xs font-normal text-[color:var(--st-text-soft)]">{copy.heartPrivate}</span>
        </label>
        <textarea id="heart-body" name="story" required maxLength={2000} rows={4} placeholder={copy.heartPlaceholder} className="st-field" />
        <button type="submit" disabled={saving} className="st-btn st-btn-sage">{saving ? copy.saving : copy.heartSave}</button>
      </form>
    </section>
  );
}

type AlbumScope = "all" | "thisYear" | "lastYear" | "others";

/** Folder-shaped scope list beside the month carousel. */
function AlbumFolderBrowser({
  months,
  albumHref,
  copy,
  lang,
  scope,
  onScopeChange,
  totals,
  thisYearKey,
  lastYearKey,
}: {
  months: YearMonthFolder[];
  albumHref: string;
  copy: PetFirstCopy;
  lang: "ko" | "en";
  scope: AlbumScope;
  onScopeChange: (next: AlbumScope) => void;
  totals: Record<AlbumScope, number>;
  thisYearKey: string;
  lastYearKey: string;
}) {
  const scopes: Array<{ id: AlbumScope; label: string; detail: string }> = [
    { id: "all", label: copy.scopeAll, detail: folderMemoryCount(lang, totals.all) },
    { id: "thisYear", label: copy.scopeThisYear, detail: `${thisYearKey} · ${folderMemoryCount(lang, totals.thisYear)}` },
    { id: "lastYear", label: copy.scopeLastYear, detail: `${lastYearKey} · ${folderMemoryCount(lang, totals.lastYear)}` },
    { id: "others", label: copy.scopeOthers, detail: totals.others > 0 ? folderMemoryCount(lang, totals.others) : copy.scopeOthersBody },
  ];

  return (
    <div className="relative left-1/2 mt-3 w-[calc(100vw-2rem)] max-w-5xl -translate-x-1/2 lg:flex lg:items-start lg:gap-8">
      <nav aria-label={copy.storiesTitle} className="shrink-0 px-1 lg:w-56 lg:px-0 lg:pt-10">
        <h3 className="st-headline text-xl leading-tight text-[#3f4a33] sm:text-2xl lg:uppercase lg:tracking-[0.02em]">
          {copy.storiesTitle}
        </h3>
        <ul className="mt-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-6 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
          {scopes.map((item) => {
            const isActive = item.id === scope;
            return (
              <li key={item.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => onScopeChange(item.id)}
                  aria-pressed={isActive}
                  className={`flex w-full min-w-44 items-center gap-3 rounded-[16px] px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--st-focus)] lg:min-w-0 ${isActive ? "bg-[#f3ead6] shadow-[inset_0_0_0_1px_rgba(168,154,113,0.45)]" : "hover:bg-[#f6f1e4]"}`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-7 shrink-0 ${isActive ? "text-[#7d8b4e]" : "text-[#d6c8a6]"}`}>
                    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.3a1.5 1.5 0 0 1 1.06.44l1.2 1.2a1.5 1.5 0 0 0 1.06.44h7.38A1.5 1.5 0 0 1 21 9.58v8.42a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z" fill="currentColor" />
                  </svg>
                  <span className="min-w-0">
                    <span className={`block truncate text-[0.95rem] font-semibold ${isActive ? "text-[#3f4a33]" : "text-[#4b4639]"}`}>{item.label}</span>
                    <span className="block truncate text-xs text-[color:var(--st-text-soft)]">{item.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {months.length === 0 ? (
        <p className="mt-6 flex-1 text-center text-sm text-[color:var(--st-text-soft)] lg:mt-16">{copy.albumEmpty}</p>
      ) : (
        // Remount on scope change so the track starts at the newest folder
        // instead of keeping the previous scroll offset.
        <MonthFolderCarousel key={scope} months={months} albumHref={albumHref} copy={copy} lang={lang} />
      )}
    </div>
  );
}

function MonthFolderCarousel({ months, albumHref, copy, lang }: { months: YearMonthFolder[]; albumHref: string; copy: PetFirstCopy; lang: "ko" | "en" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.max(0, Math.min(activeIndex, months.length - 1));
  const activeMonth = months[currentIndex];

  function scrollToFolder(index: number, behavior: ScrollBehavior = "smooth") {
    const track = trackRef.current;
    const card = track?.querySelector<HTMLElement>(`[data-folder-index="${index}"]`);
    if (!track || !card) return;
    const cardRect = card.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const left = track.scrollLeft + cardRect.left - trackRect.left - (track.clientWidth - cardRect.width) / 2;
    track.scrollTo({ left, behavior });
  }

  function moveToFolder(index: number) {
    const nextIndex = Math.max(0, Math.min(months.length - 1, index));
    setActiveIndex(nextIndex);
    scrollToFolder(nextIndex);
  }

  function syncActiveFolder(event: ReactUIEvent<HTMLDivElement>) {
    const track = event.currentTarget;
    const center = track.getBoundingClientRect().left + track.clientWidth / 2;
    const cards = [...track.querySelectorAll<HTMLElement>("[data-folder-index]")];
    let nearestIndex = currentIndex;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      const index = Number(card.dataset.folderIndex);
      if (distance < nearestDistance && Number.isInteger(index)) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestIndex !== currentIndex) setActiveIndex(nearestIndex);
  }

  return (
    <div className="relative mt-3 min-w-0 flex-1" role="group" aria-roledescription="carousel" aria-label={copy.foldersTitle}>
      {activeMonth ? (
        <p className="mx-auto flex w-fit items-center rounded-full border border-[color:var(--st-card-edge)] bg-[#fffaf0]/90 px-6 py-2 text-base font-semibold tracking-[0.08em] text-[#5f5a3f] shadow-[0_6px_16px_-12px_rgba(49,54,35,0.5)]">
          {activeMonth.year}
        </p>
      ) : null}
      <div
        ref={trackRef}
        onScroll={syncActiveFolder}
        className="flex snap-x snap-mandatory items-center overflow-x-auto overscroll-x-contain py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden before:w-[16%] before:shrink-0 before:content-[''] after:w-[16%] after:shrink-0 after:content-[''] sm:before:w-[34%] sm:after:w-[34%]"
      >
        {months.map((folder, index) => {
          const coverUrl = monthFolderCoverUrl(folder);
          const isActive = index === currentIndex;
          const title = `${folder.year} ${monthNameLabel(folder.key, lang)}`;
          return (
            <Link
              key={folder.key}
              data-folder-index={index}
              href={`${albumHref}?pane=album&folder=${folder.key}#album`}
              aria-label={`${title}, ${folderMemoryCount(lang, folder.count)}`}
              aria-current={isActive ? "true" : undefined}
              onFocus={() => moveToFolder(index)}
              className={`group relative -ml-16 block w-[58vw] max-w-[230px] shrink-0 snap-center pt-6 transition-[transform,opacity] duration-300 ease-out first:ml-0 focus-visible:z-30 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)] sm:-ml-20 sm:w-[26%] sm:max-w-[268px] ${isActive ? "scale-[1.14] opacity-100" : "scale-[0.86] opacity-90 hover:opacity-100"}`}
              style={{ zIndex: isActive ? 30 : 10 + Math.min(index, 9) }}
            >
              {/* The folder tab sits behind the photo pocket so each card reads as a folder. */}
              <div
                aria-hidden="true"
                className={`absolute left-3 top-1 z-0 h-8 w-[46%] rounded-t-[14px] border border-b-0 ${isActive ? "border-[#d8b45f] bg-[#f3e6c4]" : "border-[color:var(--st-card-edge)] bg-[#ece3d0]"}`}
              />
              <div
                className={`relative z-[1] aspect-[4/5] overflow-hidden rounded-[18px] rounded-tl-[6px] border transition-[box-shadow,border-color] duration-300 ${coverUrl ? "bg-[#4b453a]" : "bg-gradient-to-br from-[#f1ead7] via-[#e3e8d5] to-[#d4dec8]"} ${isActive ? "border-[#d8b45f] shadow-[0_26px_44px_-20px_rgba(49,43,25,0.6),0_0_0_3px_rgba(216,180,95,0.55)]" : "border-[color:var(--st-card-edge)] shadow-[0_14px_28px_-20px_rgba(49,54,35,0.5)]"}`}
              >
                {coverUrl ? (
                  <>
                    {/* Signed Storage URLs are private and outside the image optimizer allowlist. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </>
                ) : (
                  <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-x-4 bottom-4 top-6 rounded-[16px] border border-[#b6c0a4]/70 bg-[#f7f3e8]/75 shadow-inner" />
                    <svg viewBox="0 0 64 64" className="absolute left-1/2 top-[40%] size-14 -translate-x-1/2 -translate-y-1/2 text-[#8d9876]" fill="none" aria-hidden="true">
                      <path d="M8 19h18l5 6h25a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V23a4 4 0 0 1 4-4Z" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="2.5" />
                      <path d="M18 39a10 10 0 1 0 20 0 10 10 0 0 0-20 0Z" stroke="currentColor" strokeWidth="2.5" />
                      <path d="m39 29 9-7 9 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {/* The month and count read straight off the photo, as in the album design. */}
                <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t ${coverUrl ? "from-[#1d1b14]/92 via-[#1d1b14]/45 to-transparent" : "from-[#3f4a33]/80 via-[#3f4a33]/25 to-transparent"}`} />
                <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
                  <p className={`st-headline leading-none text-[#fffdf6] drop-shadow-[0_2px_6px_rgba(26,24,18,0.75)] ${isActive ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>
                    {monthShortLabel(folder.key, lang)}
                  </p>
                  <p className={`mt-1.5 font-medium text-[#f4efe2] drop-shadow-[0_1px_4px_rgba(26,24,18,0.8)] ${isActive ? "text-sm" : "text-xs"}`}>
                    {folderMemoryCount(lang, folder.count)}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {months.length > 1 ? (
        <>
          <button
            type="button"
            aria-label={copy.previousFolder}
            disabled={currentIndex <= 0}
            onClick={() => moveToFolder(currentIndex - 1)}
            className="absolute left-0 top-1/2 z-40 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--st-card-edge)] bg-[#fffaf0] text-[#5f5a3f] shadow-[0_8px_20px_-10px_rgba(49,54,35,0.55)] transition hover:bg-[#f6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--st-focus)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            type="button"
            aria-label={copy.nextFolder}
            disabled={currentIndex >= months.length - 1}
            onClick={() => moveToFolder(currentIndex + 1)}
            className="absolute right-0 top-1/2 z-40 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-[color:var(--st-card-edge)] bg-[#fffaf0] text-[#5f5a3f] shadow-[0_8px_20px_-10px_rgba(49,54,35,0.55)] transition hover:bg-[#f6efdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--st-focus)] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {months.map((folder, index) => (
              <button
                key={`dot-${folder.key}`}
                type="button"
                aria-label={`${folder.year} ${monthNameLabel(folder.key, lang)}`}
                aria-current={index === currentIndex ? "true" : undefined}
                onClick={() => moveToFolder(index)}
                className={`size-2.5 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--st-focus)] ${index === currentIndex ? "scale-125 bg-[#7d7a4a]" : "bg-[#cfc6ab] hover:bg-[#b3aa8c]"}`}
              />
            ))}
          </div>
          <p aria-live="polite" className="sr-only">
            {activeMonth ? `${monthNameLabel(activeMonth.key, lang)} · ${activeMonth.year}` : ""} · {currentIndex + 1} / {months.length}
          </p>
        </>
      ) : null}
    </div>
  );
}

function MemoryCard({ item, petName, copy, href }: { item: TimelineItem; petName: string; copy: PetFirstCopy; href: string }) {
  const preview = item.assets.find((asset) => asset.contentType.startsWith("image/") || asset.contentType.startsWith("video/"));
  return (
    <Link href={href} aria-label={`${petName}: ${item.title || timelineDay(item)}. ${copy.openMemoryDetails}`} className="st-card block overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)]">
      {preview?.contentType.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.url} alt="" loading="lazy" className="aspect-[4/3] w-full bg-[#f8f2e5] object-cover" />
      ) : preview?.contentType.startsWith("video/") ? (
        <video src={preview.url} muted playsInline preload="metadata" aria-hidden="true" className="aspect-[4/3] w-full bg-[#f8f2e5] object-cover" />
      ) : null}
      <div className="px-4 py-3">
        <p className="text-xs text-[color:var(--st-text-soft)]">{timelineDay(item)}</p>
        {item.title ? <p className="st-pen mt-1 text-lg leading-snug">{item.title}</p> : null}
        {item.story ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-[color:var(--st-text-soft)]">{item.story}</p> : null}
        {!item.title && !item.story && !preview ? <p className="mt-1 text-sm">{petName}</p> : null}
        <span className="mt-2 inline-flex text-sm font-medium text-[color:var(--st-olive)]">{copy.openMemoryDetails}</span>
      </div>
    </Link>
  );
}

function AlbumEntry({
  item,
  copy,
  petName,
  letterHref,
  polaroidHref,
  beamHref,
  onRemove,
  onPatch,
}: {
  item: TimelineItem;
  copy: PetFirstCopy;
  petName: string;
  letterHref?: string;
  polaroidHref?: string;
  beamHref?: string;
  onRemove?: () => void;
  onPatch?: (patch: { title?: string | null; story?: string | null; place?: string | null; happenedOn?: string | null; favorite?: boolean }) => void;
}) {
  const images = item.assets.filter((asset) => asset.contentType.startsWith("image/"));
  const videos = item.assets.filter((asset) => asset.contentType.startsWith("video/"));
  return (
    <li className="st-card px-4 py-4 sm:px-5">
      <p className="text-xs text-[color:var(--st-text-soft)]">
        {describeMemoryDate(item.happenedOn) === "owner-entered" ? copy.chosenOn : copy.savedOn}
        {" "}
        {timelineDay(item)}
        {item.place ? ` · ${item.place}` : ""}
      </p>
      {images.length ? (
        <div className={`mt-3 grid gap-3 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {images.map((asset) => (
            <div key={asset.assetId} className="st-polaroid">
              {/* Signed storage URLs expire and are outside the image optimizer allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={item.title || petName} loading="lazy" className="aspect-square w-full rounded-md object-contain bg-[#f8f2e5]" />
            </div>
          ))}
        </div>
      ) : null}
      {videos.map((asset) => (
        <video key={asset.assetId} src={asset.url} controls preload="metadata" className="mt-3 w-full rounded-2xl bg-[color:var(--st-cream)]" />
      ))}
      {item.title ? <p className="st-pen mt-3 text-xl leading-snug">{item.title}</p> : null}
      {item.story ? <p className="mt-2 whitespace-pre-wrap text-[0.95rem] leading-relaxed">{item.story}</p> : null}
      {item.origin === "legacy" ? <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.legacyNote}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {images.length && polaroidHref ? <Link href={polaroidHref} className="st-btn st-btn-quiet min-h-11 px-3 text-xs">{copy.makePolaroid}</Link> : null}
        {letterHref ? <Link href={letterHref} className="st-btn st-btn-quiet min-h-11 px-3 text-xs">{copy.makeLetter}</Link> : null}
        {images.length && beamHref ? <Link href={beamHref} className="st-btn st-btn-quiet min-h-11 px-3 text-xs">{copy.makeBeamScene}</Link> : null}
        {onPatch ? (
          <button type="button" onClick={() => onPatch({ favorite: !item.favorite })} className="st-btn st-btn-quiet min-h-11 px-3 text-xs">
            {item.favorite ? copy.favoriteRemove : copy.favoriteAdd}
          </button>
        ) : null}
      </div>
      {onPatch ? (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer text-sm">{copy.editMemory}</summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              onPatch({
                title: String(data.get("title") ?? "") || null,
                story: String(data.get("story") ?? "") || null,
                place: String(data.get("place") ?? "") || null,
                happenedOn: String(data.get("happenedOn") ?? "") || null,
              });
            }}
          >
            <input name="title" defaultValue={item.title ?? ""} maxLength={80} placeholder={copy.captionPlaceholder} className="st-field" />
            <label className="block text-sm font-medium">
              {copy.storyLabel}
              <textarea name="story" defaultValue={item.story ?? ""} maxLength={2000} rows={4} required={item.kind === "text"} className="st-field mt-1.5" />
            </label>
            <input name="place" defaultValue={item.place ?? ""} maxLength={80} placeholder={copy.placePlaceholder} className="st-field" />
            <input name="happenedOn" type="date" defaultValue={item.happenedOn ?? ""} className="st-field" />
            <button type="submit" className="st-btn st-btn-sage">{copy.saveEdit}</button>
          </form>
        </details>
      ) : null}
      {onRemove ? (
        <button type="button" onClick={onRemove} className="mt-3 inline-flex min-h-11 items-center text-sm text-[color:var(--st-text-soft)] underline-offset-4 hover:underline">
          {copy.delete}
        </button>
      ) : null}
    </li>
  );
}

function TogetherCard({
  scene,
  title,
  body,
  soon,
  note,
  href,
}: {
  scene: "memorial" | "letter" | "home";
  title: string;
  body: string;
  soon?: string;
  note?: string;
  href?: string;
}) {
  const inner = (
    <>
      <StoryScene scene={scene} className="rounded-none" />
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-medium">{title}</p>
          {soon ? <span className="shrink-0 rounded-full bg-[color:var(--st-beige)] px-2.5 py-1 text-xs">{soon}</span> : null}
        </div>
        <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{body}</p>
        {note ? <p className="mt-2 text-xs text-[color:var(--st-text-soft)]">{note}</p> : null}
      </div>
    </>
  );
  if (href) {
    return <Link href={href} className="st-card block overflow-hidden">{inner}</Link>;
  }
  return <article className="st-card overflow-hidden">{inner}</article>;
}

function TextLine({ id, name, label, placeholder, optional }: { id: string; name: string; label: string; placeholder: string; optional: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} <span className="font-normal text-[color:var(--st-text-soft)]">({optional})</span>
      </label>
      <input id={id} name={name} maxLength={80} placeholder={placeholder} className="st-field" />
    </div>
  );
}

function DateField({ id, copy }: { id: string; copy: PetFirstCopy }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {copy.dateLabel} <span className="font-normal text-[color:var(--st-text-soft)]">({copy.optional})</span>
      </label>
      <input id={id} name="memoryDate" type="date" className="st-field" aria-describedby={`${id}-hint`} />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-[color:var(--st-text-soft)]">{copy.dateHint}</p>
    </div>
  );
}

function SubmitButton({ saving, disabled = false, copy, label }: { saving: boolean; disabled?: boolean; copy: PetFirstCopy; label: string }) {
  return (
    <button type="submit" disabled={saving || disabled} className="st-btn st-btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50">
      {saving ? copy.saving : label}
    </button>
  );
}

function PictureMark({ video = false }: { video?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 text-[color:var(--st-accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {video ? (
        <>
          <rect x="4" y="8" width="18" height="16" rx="3" />
          <path d="m22 14 6-3v10l-6-3" />
        </>
      ) : (
        <>
          <rect x="4" y="6" width="24" height="20" rx="3" />
          <circle cx="11" cy="13" r="2.5" />
          <path d="m5 23 7-6 5 4 4-3 6 5" />
        </>
      )}
    </svg>
  );
}

const VIDEO_LIMIT_SECONDS = 29.5;

function LiveCamera({
  mode,
  copy,
  onPhoto,
  onVideo,
  onClose,
}: {
  mode: "photo" | "video";
  copy: PetFirstCopy;
  onPhoto: (file: File) => void;
  onVideo: (file: File, durationSeconds: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef(0);
  const acceptRef = useRef(true);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const release = useCallback(() => {
    acceptRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const open = navigator.mediaDevices?.getUserMedia?.({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: mode === "video",
    });
    // An unsupported camera and a denied permission are the same outcome for
    // this screen, so both report through the rejection path below instead of
    // setting state synchronously in the effect body.
    const opening = open ?? Promise.reject(new Error("camera_unavailable"));
    opening.then((stream) => {
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const element = videoRef.current;
      if (element) {
        element.srcObject = stream;
        void element.play().catch(() => undefined);
      }
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      release();
    };
  }, [mode, release]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - startedRef.current) / 1000;
      setSeconds(Math.min(30, Math.floor(elapsed)));
      if (elapsed >= VIDEO_LIMIT_SECONDS) stopRecording();
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording, stopRecording]);

  function close() {
    release();
    onClose();
  }

  function shoot() {
    const element = videoRef.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(element, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onPhoto(new File([blob], `scene-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream || recording || typeof MediaRecorder === "undefined") {
      setError(true);
      return;
    }
    const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream);
    } catch {
      setError(true);
      return;
    }
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!acceptRef.current) return;
      const raw = recorder.mimeType || mime || "video/webm";
      const type = raw.startsWith("video/mp4") ? "video/mp4" : "video/webm";
      const extension = type === "video/mp4" ? "mp4" : "webm";
      const duration = Math.min(VIDEO_LIMIT_SECONDS, Math.max(0.2, (Date.now() - startedRef.current) / 1000));
      onVideo(new File(chunksRef.current, `memory-${Date.now()}.${extension}`, { type }), duration);
    };
    startedRef.current = Date.now();
    acceptRef.current = true;
    try {
      recorder.start();
    } catch {
      setError(true);
      return;
    }
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#2a2118]/55 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={mode === "photo" ? copy.photoCapture : copy.videoLibrary}>
      <div className="w-full max-w-md overflow-hidden rounded-[22px] bg-[#fffaf0] text-[#393129] shadow-[0_18px_40px_-24px_rgba(42,33,24,0.7)]">
        <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full bg-[#1c1612] object-contain" />
        <div className="space-y-3 px-4 py-4">
          {error ? <p className="text-sm text-[#8a4b32]">{copy.cameraDenied}</p> : null}
          {!error && !ready ? <p className="text-sm text-[color:var(--st-text-soft)]">{copy.cameraPreparing}</p> : null}
          {recording ? <p className="text-center text-sm tabular-nums">{seconds}s / 30s</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="st-btn st-btn-quiet" onClick={close}>{copy.cameraClose}</button>
            {mode === "photo" ? (
              <button type="button" className="st-btn st-btn-primary" disabled={!ready || error} onClick={shoot}>{copy.cameraShoot}</button>
            ) : (
              <button type="button" className="st-btn st-btn-primary" disabled={!ready || error} onClick={recording ? stopRecording : startRecording}>
                {recording ? copy.cameraStop : copy.cameraRecord}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function monthLabel(key: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00Z`));
}

function monthNameLabel(key: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { month: "long", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00Z`));
}

/** Short month for the folder cover ("Nov", "11월"). Full names stay elsewhere. */
function monthShortLabel(key: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00Z`));
}

function videoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration)) reject(new Error("duration"));
      else resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("duration"));
    };
    video.src = url;
  });
}
