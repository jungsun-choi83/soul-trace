"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import {
  BEAM_PLACES,
  beamDualDisplay,
  createBeamSceneDraft,
  splitBeamAssets,
  type BeamPlace,
  type MemoryLibraryItem,
} from "@/lib/memory-library";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import { POSE_ART } from "@/lib/pose-art";
import { GUEST_PREVIEW_PET_ID, petFirstCopy } from "@/lib/pet-first-archive";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PLACE_ART: Record<BeamPlace, string> = {
  home: "/images/design/livingroom.jpg",
  park: "/images/design/monthly-meadow.jpg",
  travel: "/images/art/corgi-autumn.png",
  other: "/images/design/sunroom.jpg",
};

export function BeamScenePreview({
  profile,
  initialEntryId,
  initialAssetId,
}: {
  profile: PetProfile;
  initialEntryId?: string | null;
  initialAssetId?: string | null;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const petId = profile.petId;
  const [timeline, setTimeline] = useState<MemoryLibraryItem[]>([]);
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState<BeamPlace>("home");
  const [entryId, setEntryId] = useState(initialEntryId ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (petId === GUEST_PREVIEW_PET_ID) return;
    const response = await fetch(`/api/my/pets/${petId}/memories`);
    if (!response.ok) return;
    const body = await response.json() as { timeline?: MemoryLibraryItem[] };
    const photos = (body.timeline ?? []).filter((item) => item.assets.some((asset) => asset.contentType.startsWith("image/")));
    setTimeline(photos);
    setEntryId((current) => current || photos[0]?.entryId || "");
  }, [petId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selected = timeline.find((item) => item.entryId === entryId) ?? timeline[0] ?? null;
  const photo = selected?.assets.find((asset) => asset.assetId === initialAssetId && asset.contentType.startsWith("image/"))
    ?? selected?.assets.find((asset) => asset.contentType.startsWith("image/"))
    ?? null;
  const draft = useMemo(() => createBeamSceneDraft({
    petId,
    entryId: selected?.entryId ?? null,
    assetId: photo?.assetId ?? null,
    title: title || selected?.title || profile.petName,
    happenedOn: selected?.happenedOn ?? selected?.createdAt.slice(0, 10) ?? null,
    place,
    originalUrl: photo?.url ?? null,
    derivativeUrl: null,
  }), [petId, photo, place, profile.petName, selected, title]);
  const dual = beamDualDisplay(draft);
  const assets = splitBeamAssets(draft.originalUrl, draft.derivativeUrl);

  async function saveDraft() {
    setSaving(true);
    const response = await fetch(`/api/my/pets/${petId}/beam-scenes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        place: draft.place,
        happenedOn: draft.happenedOn,
        originalAssetId: draft.assetId,
      }),
    });
    setSaving(false);
    setNotice(response.ok ? copy.beamSavedLocal : copy.saveError);
  }

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref={`/my/pets/${petId}#album`} backLabel={copy.albumTitle} />
        <UiuxHero src={POSE_ART.shibaAutumn} title={copy.beamSceneTitle} body={copy.beamSceneBody} />
        <p className="st-eyebrow mt-4">{copy.beamSceneEyebrow}</p>
        <p className="mt-2 text-xs text-[color:var(--st-text-soft)]">{copy.beamNoPlayback}</p>

        <figure className="st-card mt-6 overflow-hidden">
          <div className="relative aspect-[4/5] bg-[#1d1916]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PLACE_ART[place]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
            {assets.original ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assets.original} alt={draft.title} className="absolute inset-x-[12%] bottom-[8%] top-[18%] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={POSE_ART.shibaSpring} alt="" className="absolute inset-x-[8%] bottom-[6%] top-[12%] object-contain object-center" />
            )}
          </div>
          <figcaption className="space-y-1 px-5 py-4">
            <p className="st-headline text-xl">{draft.title || copy.beamSceneName}</p>
            <p className="text-sm text-[color:var(--st-text-soft)]">{draft.happenedOn ?? copy.savedOn}</p>
            <p className="text-xs text-[color:var(--st-text-soft)]">{copy.beamDualNote}</p>
          </figcaption>
        </figure>

        <dl className="st-card mt-4 divide-y divide-[color:var(--st-card-edge)] px-5">
          <Row label={copy.beamBackground} value={placeLabel(copy, place)} />
          <Row label={copy.beamForeground} value={dual.right.source === "original_photo" ? copy.statPhotos : copy.plannedVisualMemory} />
          <Row label={copy.beamSceneName} value={draft.title || "—"} />
          <Row label={copy.dateLabel} value={draft.happenedOn ?? "—"} />
        </dl>
        <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.beamOriginalKept}</p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            {copy.beamSceneName}
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} className="st-field mt-1.5" placeholder={profile.petName} />
          </label>
          <fieldset>
            <legend className="text-sm font-medium">{copy.beamBackground}</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {BEAM_PLACES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={place === value}
                  onClick={() => setPlace(value)}
                  className={`st-btn min-h-11 ${place === value ? "st-btn-sage" : "st-btn-quiet"}`}
                >
                  {placeLabel(copy, value)}
                </button>
              ))}
            </div>
          </fieldset>
          {timeline.length ? (
            <fieldset>
              <legend className="text-sm font-medium">{copy.favoriteScenes}</legend>
              <ul className="mt-2 grid grid-cols-3 gap-2">
                {timeline.slice(0, 9).map((item) => {
                  const image = item.assets.find((asset) => asset.contentType.startsWith("image/"));
                  if (!image) return null;
                  return (
                    <li key={item.entryId}>
                      <button type="button" onClick={() => setEntryId(item.entryId)} className={`block w-full overflow-hidden rounded-[12px] ${item.entryId === selected?.entryId ? "ring-2 ring-[color:var(--st-sage-deep)]" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt={item.title || profile.petName} className="aspect-square w-full object-contain bg-[#f8f2e5]" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : (
            <StoryState kind="empty" title={copy.albumEmpty} />
          )}
          <button type="button" disabled={saving || !photo} onClick={() => void saveDraft()} className="st-btn st-btn-primary w-full">
            {saving ? copy.saving : copy.beamSaveDraft}
          </button>
          <Link href={`/beam/scenes?pet=${encodeURIComponent(petId)}&branch=${profile.lifeStatus}`} className="st-btn st-btn-quiet w-full">
            {lang === "en" ? "Scene library" : "장면 보관함"}
          </Link>
          <Link href={`/beam/device-info?branch=${profile.lifeStatus}`} className="st-btn st-btn-quiet w-full">
            {lang === "en" ? "Device guide" : "기기 안내"}
          </Link>
          {notice ? <StoryState kind={notice === copy.saveError ? "error" : "success"} title={notice} /> : null}
        </div>
      </main>
      <StoryTabbar current="memories" {...storyTabProps(copy, petId, true, profile.lifeStatus)} />
    </div>
  );
}

function placeLabel(copy: ReturnType<typeof petFirstCopy>, place: BeamPlace) {
  if (place === "home") return copy.beamPlaceHome;
  if (place === "park") return copy.beamPlacePark;
  if (place === "travel") return copy.beamPlaceTravel;
  return copy.beamPlaceOther;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-[color:var(--st-text-soft)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
