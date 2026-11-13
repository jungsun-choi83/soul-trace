"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel, storyTabProps } from "@/components/pet-first-home";
import { StatusPill, StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import {
  beamSceneHref,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  letterHrefForPet,
  moodJournalHref,
  polaroidHrefFromArchive,
  type MemoryLibraryItem,
} from "@/lib/memory-library";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import { GUEST_PREVIEW_PET_ID, letterPathForLifeStatus, petFirstCopy, timelineMonthKey } from "@/lib/pet-first-archive";
import { fill } from "@/lib/storybook-copy";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export function MemorialSpace({ profile, today }: { profile: PetProfile; today: string }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const petId = profile.petId;
  const [timeline, setTimeline] = useState<MemoryLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    if (petId === GUEST_PREVIEW_PET_ID) {
      setTimeline([]);
      setLoading(false);
      return;
    }
    const response = await fetch(`/api/my/pets/${petId}/memories`);
    setLoading(false);
    if (!response.ok) {
      setLoadError(true);
      return;
    }
    const body = await response.json() as { timeline?: MemoryLibraryItem[] };
    setTimeline((body.timeline ?? []).map(withLibraryDefaults));
  }, [petId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const photos = timeline.filter((item) => item.kind === "photo" && !isMoodJournalItem(item));
  const notes = timeline.filter((item) => item.kind === "text" && !isMoodJournalItem(item));
  const monthKey = today.slice(0, 7);
  const monthEntries = photos.filter((item) => timelineMonthKey(item) === monthKey);
  const groups = groupLibraryByMonthAndDay(photos);
  const letterHref = letterPathForLifeStatus("memorial", petId);

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref={`/my/pets/${petId}`} settingsHref="/settings" settingsLabel={copy.settingsTitle} />

        <section className="st-rise mt-3">
          <UiuxHero title={copy.memorialSpaceTitle} body={copy.memorialSpaceBody} />
          <div className="relative mt-4 px-2">
            <p className="st-eyebrow">{copy.memorialSpaceEyebrow}</p>
            <h1 className="st-headline mt-1 text-3xl">{profile.petName}</h1>
            <div className="mt-2">
              <StatusPill>{statusLabel(copy, "memorial")}</StatusPill>
            </div>
            <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.memorialQuiet} {copy.noReminder}</p>
          </div>
        </section>

        <nav className="mt-6 grid grid-cols-2 gap-2">
          <QuietLink href={`/my/pets/${petId}#album`} label={copy.memorialAlbum} />
          <QuietLink href={letterHref} label={copy.rereadLetter} />
          <QuietLink href={polaroidHrefFromArchive(petId)} label={copy.makePolaroid} />
          <QuietLink href={moodJournalHref(petId)} label={copy.openMoodJournal} />
        </nav>

        <section className="mt-10" aria-labelledby="memorial-photos">
          <h2 id="memorial-photos" className="st-headline text-2xl">{copy.memorialAlbum}</h2>
          {loading ? <StoryState kind="loading" title={copy.loading} /> : null}
          {loadError ? <StoryState kind="error" title={copy.loadError} /> : null}
          {!loading && !photos.length ? (
            <p className="st-card mt-4 px-5 py-4 text-sm text-[color:var(--st-text-soft)]">{copy.albumEmpty}</p>
          ) : null}
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {photos.flatMap((item) => item.assets.filter((asset) => asset.contentType.startsWith("image/")).map((asset) => (
              <li key={asset.assetId} className="overflow-hidden rounded-[15px] bg-[#f8f2e5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={item.title || profile.petName} className="aspect-square w-full object-contain bg-[#f8f2e5]" />
              </li>
            )))}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="memorial-month">
          <h2 id="memorial-month" className="st-headline text-2xl">{copy.thisMonth}</h2>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{fill(copy.monthlyCount, { COUNT: monthEntries.length })}</p>
          {groups.map((month) => (
            <div key={month.key} className="mt-6">
              <h3 className="st-pen text-2xl text-[color:var(--st-brown)]">{monthLabel(month.key, lang)}</h3>
              {month.days.map((day) => (
                <div key={day.key} className="mt-3">
                  <p className="text-xs text-[color:var(--st-text-soft)]">{day.key}</p>
                  <ul className="mt-2 grid grid-cols-3 gap-2">
                    {day.items.flatMap((item) => item.assets.filter((asset) => asset.contentType.startsWith("image/")).slice(0, 3).map((asset) => (
                      <li key={asset.assetId}>
                        <Link href={beamSceneHref(petId, item.entryId, asset.assetId)} className="block overflow-hidden rounded-[12px] bg-[#f8f2e5]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.url} alt={item.title || profile.petName} className="aspect-square w-full object-contain" />
                        </Link>
                      </li>
                    )))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className="st-card mt-10 px-5 py-5">
          <h2 className="st-headline text-xl">{copy.letterCardTitle}</h2>
          <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.letterCardBody}</p>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{profile.letterCount} · {copy.statLetters}</p>
          <Link href={letterHrefForPet("memorial", petId)} className="st-btn st-btn-quiet mt-4 w-full">{copy.togetherLetter}</Link>
        </section>

        <section className="mt-10">
          <h2 className="st-headline text-xl">{copy.heartTitle}</h2>
          <p className="mt-1 text-xs text-[color:var(--st-text-soft)]">{copy.heartPrivate}</p>
          {notes.length ? (
            <ul className="mt-4 space-y-3">
              {notes.slice(0, 5).map((item) => (
                <li key={item.entryId} className="st-card px-5 py-4">
                  {item.title ? <p className="font-medium">{item.title}</p> : null}
                  {item.story ? <p className="mt-1 whitespace-pre-wrap text-sm">{item.story}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.quietBody}</p>
          )}
          <Link href={moodJournalHref(petId)} className="st-btn st-btn-sage mt-4 w-full">{copy.openMoodJournal}</Link>
        </section>
      </main>
      <StoryTabbar current="home" {...storyTabProps(copy, petId, true, "memorial")} />
    </div>
  );
}

export function MemorialSpaceClosed({ reason }: { reason: "not_memorial" | "not_found" }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  return (
    <div className={`st-paper st-grain st-body min-h-[100svh] ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto flex min-h-[100svh] max-w-xl items-center px-4 py-10">
        <StoryState
          kind="empty"
          scene="memorial"
          title={reason === "not_memorial" ? copy.notMemorialSpace : copy.notFound}
          action={<Link href="/dashboard" className="st-btn st-btn-quiet">{copy.tabs.home}</Link>}
        />
      </main>
    </div>
  );
}

function QuietLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="st-card flex min-h-16 items-center justify-center px-3 text-center text-sm font-medium">
      {label}
    </Link>
  );
}

function withLibraryDefaults(item: MemoryLibraryItem): MemoryLibraryItem {
  return { ...item, place: item.place ?? null, favorite: Boolean(item.favorite) };
}

function monthLabel(key: string, lang: string) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(`${key}-01T00:00:00Z`));
}
