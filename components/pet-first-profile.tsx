"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel } from "@/components/pet-first-home";
import { StatusPill, StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import { beamSceneHref, canOpenMemorialSpace, memorialSpaceHref } from "@/lib/memory-library";
import { daysTogether, petFirstCopy } from "@/lib/pet-first-archive";
import { fill } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Link from "next/link";

type ProfileMemorySummary = { moments: number; photos: number; coverUrl: string | null };

export function PetFirstProfile({ profile, today }: { profile: PetProfile; today: string }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const [summary, setSummary] = useState<ProfileMemorySummary | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/my/pets/${profile.petId}/memories`);
      if (!response.ok) {
        setSummary({ moments: 0, photos: 0, coverUrl: null });
        return;
      }
      const body = await response.json() as { timeline?: Array<{ assets?: Array<{ contentType: string; url: string }> }> };
      const timeline = body.timeline ?? [];
      const images = timeline.flatMap((item) => item.assets ?? []).filter((asset) => asset.contentType.startsWith("image/"));
      setSummary({ moments: timeline.length, photos: images.length, coverUrl: images[0]?.url ?? null });
    } catch {
      setSummary({ moments: 0, photos: 0, coverUrl: null });
    }
  }, [profile.petId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const petId = profile.petId;
  const memorial = profile.lifeStatus === "memorial";
  const together = profile.lifeStatus === "living" ? daysTogether(profile.adoptedOn, today) : null;
  const albumHref = `/my/pets/${encodeURIComponent(petId)}/memories#album`;
  const tabs = storyTabProps(copy, petId, true, profile.lifeStatus);

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <LegacyPetAlbumHashRedirect petId={petId} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref="/my/pets" settingsHref="/settings" settingsLabel={copy.settingsTitle} />
        <section className="st-rise mt-3" aria-labelledby="pet-name">
          <UiuxHero src={summary?.coverUrl ?? UIUX_GARDEN_HERO} title={profile.petName} body={copy.profileEyebrow}>
            <div className="mt-3"><StatusPill tone={profile.lifeStatus === "living" ? "living" : "quiet"}>{statusLabel(copy, profile.lifeStatus)}</StatusPill></div>
          </UiuxHero>
          <div className="relative mt-4 px-2">
            <h1 id="pet-name" className="sr-only">{profile.petName}</h1>
            <Link href={`/my/pets/${encodeURIComponent(petId)}/edit`} className="st-link mt-2 inline-flex min-h-11 items-center text-sm">{copy.editPet}</Link>
            {profile.species ? <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{profile.species}</p> : null}
            {together !== null ? <p className="st-pen mt-3 text-2xl text-[color:var(--st-brown)]">{fill(copy.daysTogether, { COUNT: together.toLocaleString(lang === "ko" ? "ko-KR" : "en-US") })}</p> : null}
            {profile.traits ? <blockquote className="st-pen mt-4 border-l-2 border-[color:var(--st-rose)] pl-4 text-xl leading-snug text-[color:var(--st-ink)]">{profile.traits}</blockquote> : null}
            {profile.birthday || profile.adoptedOn ? (
              <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {profile.birthday ? <div className="flex gap-2"><dt className="text-[color:var(--st-text-soft)]">{copy.bornOn}</dt><dd>{profile.birthday}</dd></div> : null}
                {profile.adoptedOn ? <div className="flex gap-2"><dt className="text-[color:var(--st-text-soft)]">{copy.metOn}</dt><dd>{profile.adoptedOn}</dd></div> : null}
              </dl>
            ) : null}
            <dl className="st-card mt-5 grid grid-cols-3 divide-x divide-[color:var(--st-card-edge)] py-3 text-center">
              <Stat label={copy.statMemories} value={summary ? String(summary.moments) : "·"} />
              <Stat label={copy.statPhotos} value={summary ? String(summary.photos) : "·"} />
              <Stat label={copy.statLetters} value={String(profile.letterCount)} />
            </dl>
            <Link href={albumHref} className="st-card mt-4 block px-5 py-4" id="album">
              <p className="st-headline text-lg">{copy.albumTitle}</p>
              <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.timelineCardBody}</p>
            </Link>
            {canOpenMemorialSpace(profile.lifeStatus) ? (
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
      </main>
      <StoryTabbar current="pet" {...tabs} />
    </div>
  );
}

function LegacyPetAlbumHashRedirect({ petId }: { petId: string }) {
  const router = useRouter();
  useEffect(() => {
    const destination = window.location.hash === "#compose"
      ? `/my/pets/${encodeURIComponent(petId)}/memories/record`
      : window.location.hash === "#album"
        ? `/my/pets/${encodeURIComponent(petId)}/memories#album`
        : null;
    if (destination) router.replace(destination);
  }, [petId, router]);
  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="px-2"><dt className="text-xs text-[color:var(--st-text-soft)]">{label}</dt><dd className="st-headline mt-0.5 text-2xl">{value}</dd></div>;
}
