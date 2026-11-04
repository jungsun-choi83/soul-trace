"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel, storyTabProps } from "@/components/pet-first-home";
import { StatusPill, StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryScene } from "@/components/storybook/story-scene";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import {
  beamSceneHref,
  canOpenCollar,
  canOpenMemorialSpace,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  letterHrefForPet,
  memorialSpaceHref,
  moodJournalHref,
  polaroidHrefFromArchive,
  type MemoryLibraryItem,
} from "@/lib/memory-library";
import {
  daysTogether,
  describeMemoryDate,
  isSameDayLastYear,
  letterPathForLifeStatus,
  MONTHLY_CARD_MIN_ENTRIES,
  petFirstCopy,
  timelineDay,
  timelineMonthKey,
  type LifeStatus,
} from "@/lib/pet-first-archive";
import { fill, type PetFirstCopy } from "@/lib/storybook-copy";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type TimelineItem = MemoryLibraryItem;
type ComposeMode = "photo" | "video" | "story";

function withoutEmptyFiles(data: FormData) {
  const next = new FormData();
  for (const [key, value] of data.entries()) {
    if (value instanceof File && value.size === 0) continue;
    next.append(key, value);
  }
  return next;
}

export function PetFirstMemory({ profile, today }: { profile: PetProfile; today: string }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const petId = profile.petId;
  const petName = profile.petName;
  const [status, setStatus] = useState(profile.lifeStatus);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ComposeMode>("photo");
  const [chosen, setChosen] = useState(0);
  const [showMonthly, setShowMonthly] = useState(false);
  const [pane, setPane] = useState<"record" | "collection" | "together">("record");
  const [camera, setCamera] = useState<"photo" | "video" | null>(null);
  const photoForm = useRef<HTMLFormElement>(null);
  const videoForm = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const response = await fetch(`/api/my/pets/${petId}/memories`);
    setLoading(false);
    if (!response.ok) {
      setLoadError(true);
      return;
    }
    const body = await response.json() as { timeline?: TimelineItem[] };
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

  function begin() {
    setSaving(true);
    setSaveError(false);
    setNotice(null);
  }

  function finish(form: HTMLFormElement, wasEmpty: boolean) {
    form.reset();
    setChosen(0);
    setNotice(wasEmpty ? copy.savedFirst : copy.saved);
    void load();
  }

  async function postPhoto(form: HTMLFormElement, data: FormData) {
    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) {
      setSaveError(true);
      return;
    }
    const wasEmpty = timeline.length === 0;
    begin();
    const response = await fetch(`/api/my/pets/${petId}/photos`, { method: "POST", body: data });
    setSaving(false);
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    finish(form, wasEmpty);
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    await postPhoto(form, withoutEmptyFiles(new FormData(form)));
  }

  async function saveStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const wasEmpty = timeline.length === 0;
    begin();
    const response = await fetch(`/api/my/pets/${petId}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        story: data.get("story"),
        title: data.get("title"),
        happenedOn: data.get("memoryDate"),
      }),
    });
    setSaving(false);
    if (!response.ok) {
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
    const response = await fetch(`/api/my/pets/${petId}/videos`, { method: "POST", body: data });
    setSaving(false);
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    finish(form, wasEmpty);
  }

  async function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    const response = await fetch(`/api/my/pets/${petId}/memories`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setTimeline((current) => current.filter((item) => item.entryId !== entryId));
  }

  async function patchMemory(entryId: string, patch: { title?: string | null; place?: string | null; happenedOn?: string | null; favorite?: boolean }) {
    setSaveError(false);
    const response = await fetch(`/api/my/pets/${petId}/memories`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId, ...patch }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setTimeline((current) => current.map((item) => (item.entryId === entryId ? { ...item, ...patch } : item)));
    setNotice(copy.saved);
  }

  const memorial = status === "memorial";
  const together = status === "living" ? daysTogether(profile.adoptedOn, today) : null;
  const album = timeline.filter((item) => !isMoodJournalItem(item));
  const photoCount = album.reduce((sum, item) => sum + item.assets.filter((asset) => asset.contentType.startsWith("image/")).length, 0);
  const monthKey = today.slice(0, 7);
  const monthEntries = album.filter((item) => timelineMonthKey(item) === monthKey);
  const lastYear = album.filter((item) => isSameDayLastYear(item, today));
  const groups = groupLibraryByMonthAndDay(album);
  const favorites = album.filter((item) => item.favorite);
  const letterHref = `/life-archive?pet=${petId}`;

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref="/dashboard" settingsHref="/settings" settingsLabel={copy.settingsTitle} />

        <section className="st-rise mt-3" aria-labelledby="pet-name">
          <UiuxHero title={petName} body={copy.profileEyebrow}>
            <div className="mt-3">
              <StatusPill tone={status === "living" ? "living" : "quiet"}>{statusLabel(copy, status)}</StatusPill>
            </div>
          </UiuxHero>
          <div className="relative mt-4 px-2">
            <h1 id="pet-name" className="sr-only">{petName}</h1>
            <Link href={`/my/pets/${petId}/edit`} className="st-link mt-2 inline-flex min-h-11 items-center text-sm">{copy.editPet}</Link>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">
              {[profile.species, statusLabel(copy, status)].filter(Boolean).join(" · ")}
            </p>
            {together ? (
              <p className="st-pen mt-3 text-2xl text-[color:var(--st-brown)]">{fill(copy.daysTogether, { COUNT: together.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") })}</p>
            ) : null}
            {profile.traits ? (
              <blockquote className="st-pen mt-4 border-l-2 border-[color:var(--st-rose)] pl-4 text-xl leading-snug text-[color:var(--st-ink)]">
                {profile.traits}
              </blockquote>
            ) : null}
            {profile.birthday || profile.adoptedOn ? (
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {profile.birthday ? <div className="flex gap-2"><dt className="text-[color:var(--st-text-soft)]">{copy.bornOn}</dt><dd>{profile.birthday}</dd></div> : null}
                {profile.adoptedOn ? <div className="flex gap-2"><dt className="text-[color:var(--st-text-soft)]">{copy.metOn}</dt><dd>{profile.adoptedOn}</dd></div> : null}
              </dl>
            ) : null}
            <dl className="st-card mt-5 grid grid-cols-3 divide-x divide-[color:var(--st-card-edge)] py-3 text-center">
              <Stat label={copy.statMemories} value={loading ? "·" : String(timeline.length)} />
              <Stat label={copy.statPhotos} value={loading ? "·" : String(photoCount)} />
              <Stat label={copy.statLetters} value={String(profile.letterCount)} />
            </dl>
            {canOpenCollar(status) ? (
              <Link href={`/my/device?pet=${encodeURIComponent(petId)}`} className="st-card mt-4 block px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)]">
                <p className="st-headline text-lg">{copy.collarCardTitle}</p>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.collarCardBody}</p>
              </Link>
            ) : null}
            {canOpenMemorialSpace(status) ? (
              <Link href={memorialSpaceHref(petId)} className="st-card mt-4 block px-5 py-4">
                <p className="st-headline text-lg">{copy.openMemorialSpace}</p>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.memorialSpaceBody}</p>
              </Link>
            ) : null}
            <Link href={beamSceneHref(petId)} className="st-card mt-4 block px-5 py-4">
              <p className="st-headline text-lg">{copy.makeBeamScene}</p>
              <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.beamSceneBody}</p>
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <p className="st-eyebrow">{pane === "together" ? (memorial ? copy.memorialTogetherEyebrow : copy.togetherEyebrow) : pane === "collection" ? (memorial ? copy.memorialCollectionEyebrow : copy.collectionEyebrow) : (memorial ? copy.memorialArchiveEyebrow : copy.archiveEyebrow)}</p>
          <h2 className="st-headline mt-2 text-2xl">
            {pane === "together"
              ? (memorial ? copy.memorialTogetherTitle : copy.togetherTitle)
              : pane === "collection"
                ? (memorial ? copy.memorialCollectionTitle : copy.collectionTitle)
                : fill(memorial ? copy.memorialArchiveTitle : copy.archiveTitle, { NAME: petName })}
          </h2>
          <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">
            {pane === "together"
              ? (memorial ? copy.memorialTogetherBody : fill(copy.togetherBody, { NAME: petName }))
              : pane === "collection"
                ? (memorial ? copy.memorialCollectionBody : copy.collectionBody)
                : (memorial ? copy.memorialArchiveBody : copy.archiveBody)}
          </p>
        </section>

        <div className="mt-5 grid grid-cols-3 gap-2" role="tablist" aria-label={copy.tabs.memories}>
          {([
            ["record", copy.memoryTabRecord],
            ["collection", copy.memoryTabCollection],
            ["together", copy.memoryTabTogether],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={pane === id}
              onClick={() => setPane(id)}
              className={`st-btn min-h-11 px-2 text-sm ${pane === id ? "st-btn-sage" : "st-btn-quiet"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {pane === "together" ? (
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

        {pane === "collection" ? (
          <section className="mt-6">
            <h3 className="st-headline text-lg">{copy.favoriteScenes}</h3>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.plannedFavorites}</p>
            {!favorites.length ? <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.favoriteEmpty}</p> : null}
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {(favorites.length ? favorites : album).flatMap((item) => item.assets.filter((asset) => asset.contentType.startsWith("image/") || asset.contentType.startsWith("video/")).map((asset) => (
                <li key={asset.assetId} className="overflow-hidden rounded-[15px] bg-[#f8f2e5]">
                  {asset.contentType.startsWith("video/") ? (
                    <video src={asset.url} controls className="aspect-square w-full object-contain bg-[#f8f2e5]" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.url} alt={item.title || petName} className="aspect-square w-full object-contain bg-[#f8f2e5]" />
                  )}
                </li>
              )))}
            </ul>
          </section>
        ) : null}

        {pane === "record" && memorial ? (
          <MemorialRoom copy={copy} letterCount={profile.letterCount} letterHref={letterHref} saving={saving} onSave={saveStory} />
        ) : null}

        {pane === "record" ? <>
        <section id="compose" className="mt-10 scroll-mt-6" aria-labelledby="compose-title">
          <h2 id="compose-title" className="st-headline text-2xl">{copy.composeTitle}</h2>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.composeBody}</p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={copy.composeTitle}>
            {(["photo", "video", "story"] as ComposeMode[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => { setMode(value); setChosen(0); }}
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
                    <input id="pet-photo" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setChosen(event.currentTarget.files?.length ?? 0)} />
                  </label>
                </div>
                <p className="text-xs text-[color:var(--st-text-soft)]">{copy.photoHint}</p>
                <TextLine id="photo-caption" name="caption" label={copy.captionLabel} placeholder={copy.captionPlaceholder} optional={copy.optional} />
                <TextLine id="photo-place" name="place" label={copy.placeLabel} placeholder={copy.placePlaceholder} optional={copy.optional} />
                <DateField id="photo-date" copy={copy} />
                <p className="text-xs text-[color:var(--st-text-soft)]">{copy.webUploadOnly}</p>
                <SubmitButton saving={saving} copy={copy} label={copy.savePhoto} />
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

        <section id="monthly" className="mt-12 scroll-mt-6" aria-labelledby="monthly-title">
          <h2 id="monthly-title" className="st-headline text-2xl">{copy.thisMonth}</h2>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{fill(copy.monthlyCount, { COUNT: monthEntries.length })}</p>
          {monthEntries.length >= MONTHLY_CARD_MIN_ENTRIES ? (
            <>
              <button type="button" aria-expanded={showMonthly} onClick={() => setShowMonthly((open) => !open)} className="st-btn st-btn-primary mt-4">
                {showMonthly ? copy.monthlyHide : copy.monthlyCreate}
              </button>
              {showMonthly ? <MonthlyCard copy={copy} petName={petName} monthKey={monthKey} lang={lang} entries={monthEntries} /> : null}
            </>
          ) : (
            <p className="st-card mt-4 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">
              {fill(copy.monthlyLocked, { COUNT: MONTHLY_CARD_MIN_ENTRIES - monthEntries.length })}
            </p>
          )}
        </section>

        {lastYear.length ? (
          <section className="mt-12" aria-labelledby="last-year-title">
            <h2 id="last-year-title" className="st-headline text-2xl">{copy.lastYear}</h2>
            <ul className="mt-4 space-y-4">
              {lastYear.map((item) => <AlbumEntry key={`ly-${item.origin}-${item.entryId}`} item={item} copy={copy} petName={petName} />)}
            </ul>
          </section>
        ) : null}

        <section id="album" className="mt-12 scroll-mt-6" aria-labelledby="album-title" aria-busy={loading}>
          <h2 id="album-title" className="st-headline text-2xl">{memorial ? copy.memorialAlbum : copy.albumTitle}</h2>
          <div className="mt-4">
            {loading ? <StoryState kind="loading" title={copy.loading} /> : null}
            {loadError ? (
              <StoryState
                kind="error"
                title={copy.loadError}
                action={<button type="button" onClick={() => void load()} className="st-btn st-btn-quiet">{copy.retry}</button>}
              />
            ) : null}
            {!loading && !loadError && timeline.length === 0 ? (
              <StoryState
                kind="empty"
                scene="timeline"
                title={copy.albumEmpty}
                action={<a href="#compose" className="st-btn st-btn-primary">{copy.todayCta}</a>}
              />
            ) : null}
          </div>
          {groups.map((group) => (
            <div key={group.key} className="mt-8">
              <h3 className="st-pen text-2xl text-[color:var(--st-brown)]">{monthLabel(group.key, lang)}</h3>
              {group.days.map((day) => (
                <div key={day.key} className="mt-4">
                  <p className="text-xs text-[color:var(--st-text-soft)]">{day.key} · {day.items.length}</p>
                  <ul className="mt-2 space-y-4">
                    {day.items.map((item) => (
                      <AlbumEntry
                        key={`${item.origin}-${item.entryId}`}
                        item={item}
                        copy={copy}
                        petName={petName}
                        letterHref={letterHrefForPet(status, petId)}
                        polaroidHref={polaroidHrefFromArchive(petId)}
                        beamHref={beamSceneHref(petId, item.entryId, item.assets[0]?.assetId)}
                        onRemove={item.deletable ? () => void remove(item.entryId) : undefined}
                        onPatch={item.deletable ? (patch) => void patchMemory(item.entryId, patch) : undefined}
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>
        </> : null}
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

function MonthlyCard({
  copy,
  petName,
  monthKey,
  lang,
  entries,
}: {
  copy: PetFirstCopy;
  petName: string;
  monthKey: string;
  lang: string;
  entries: TimelineItem[];
}) {
  const photos = entries.flatMap((item) => item.assets.filter((asset) => asset.contentType.startsWith("image/")).map((asset) => ({ asset, item }))).slice(0, 4);
  const line = entries.find((item) => item.story)?.story ?? entries.find((item) => item.title)?.title ?? null;
  return (
    <article className="st-card st-rise mt-5 overflow-hidden" aria-label={copy.monthlyTitle}>
      <StoryScene scene="monthly" className="rounded-none" />
      <div className="px-5 py-5 sm:px-7">
        <p className="st-eyebrow">{copy.monthlyTitle}</p>
        <h3 className="st-headline mt-1 text-2xl">{petName} · {monthLabel(monthKey, lang)}</h3>
        <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{fill(copy.monthlyCount, { COUNT: entries.length })}</p>
        {photos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {photos.map(({ asset, item }, index) => (
              <div key={asset.assetId} className={`st-polaroid ${index % 2 ? "rotate-1" : "-rotate-1"}`}>
                {/* Signed storage URLs expire and are outside the image optimizer allowlist. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={item.title || petName} className="aspect-square w-full rounded-md object-cover" />
              </div>
            ))}
          </div>
        ) : null}
        {line ? <p className="st-pen mt-5 line-clamp-4 text-xl leading-snug">“{line}”</p> : null}
        <p className="mt-5 text-xs text-[color:var(--st-text-soft)]">{copy.monthlyNote}</p>
      </div>
    </article>
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
  onPatch?: (patch: { title?: string | null; place?: string | null; happenedOn?: string | null; favorite?: boolean }) => void;
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
                place: String(data.get("place") ?? "") || null,
                happenedOn: String(data.get("happenedOn") ?? "") || null,
              });
            }}
          >
            <input name="title" defaultValue={item.title ?? ""} maxLength={80} placeholder={copy.captionPlaceholder} className="st-field" />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <dt className="text-xs text-[color:var(--st-text-soft)]">{label}</dt>
      <dd className="st-headline mt-0.5 text-2xl">{value}</dd>
    </div>
  );
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

function SubmitButton({ saving, copy, label }: { saving: boolean; copy: PetFirstCopy; label: string }) {
  return (
    <button type="submit" disabled={saving} className="st-btn st-btn-primary w-full sm:w-auto">
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
    if (!open) {
      setError(true);
      return;
    }
    open.then((stream) => {
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
