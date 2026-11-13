"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { entryHomePath } from "@/lib/entry-branch";
import {
  beamSceneHref,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  memoriesHref,
  memoriesMonthHref,
  polaroidHrefFromArchive,
  type MemoryLibraryItem,
  type MonthGroup,
} from "@/lib/memory-library";
import { seoulToday, timelineMonthKey, type LifeStatus } from "@/lib/pet-first-archive";
import { POSE_ART } from "@/lib/pose-art";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

export type MemoriesPet = {
  petId: string;
  petName: string;
  lifeStatus: LifeStatus;
  species: string | null;
  avatarUrl: string | null;
};

type MediaHit = {
  item: MemoryLibraryItem;
  assetId: string;
  url: string;
  kind: "image" | "video";
};

const EMPTY_COPY = "아직 기록한 추억이 없어요. 우리 아이의 첫 사진이나 영상을 남겨보세요.";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/quicktime";
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function MemoriesArchive({
  access,
  pets,
  selectedPetId,
  view = "archive",
  month = null,
}: {
  access: "guest" | "owner" | "unavailable";
  pets: MemoriesPet[];
  selectedPetId: string | null;
  view?: "archive" | "months";
  month?: string | null;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const pet = pets.find((item) => item.petId === selectedPetId) ?? null;
  const [items, setItems] = useState<MemoryLibraryItem[]>([]);
  const [loading, setLoading] = useState(access === "owner" && Boolean(pet));
  const [loadError, setLoadError] = useState<"login" | "unavailable" | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<MediaHit | null>(null);
  const [localPreview, setLocalPreview] = useState<{ url: string; kind: "image" | "video" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const load = useCallback(async () => {
    if (access !== "owner" || !pet) return;
    setLoading(true);
    setLoadError(null);
    const response = await fetch(`/api/my/pets/${pet.petId}/memories`);
    setLoading(false);
    if (response.status === 401) {
      setLoadError("login");
      return;
    }
    if (!response.ok) {
      setLoadError("unavailable");
      return;
    }
    const body = await response.json() as { timeline?: MemoryLibraryItem[] };
    setItems((body.timeline ?? []).map((item) => ({
      ...item,
      place: item.place ?? null,
      favorite: Boolean(item.favorite),
    })));
  }, [access, pet]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview.url);
    };
  }, [localPreview]);

  const media = items
    .filter((item) => !isMoodJournalItem(item))
    .flatMap((item) => item.assets
      .filter((asset) => asset.contentType.startsWith("image/") || asset.contentType.startsWith("video/"))
      .map((asset) => ({
        item,
        assetId: asset.assetId,
        url: asset.url,
        kind: asset.contentType.startsWith("video/") ? "video" as const : "image" as const,
      })));
  const visible = favoritesOnly ? media.filter((hit) => hit.item.favorite) : media;
  const groups = groupLibraryByMonthAndDay(visible.map((hit) => hit.item).filter((item, index, list) => list.findIndex((other) => other.entryId === item.entryId) === index));
  const folderView = view === "months";
  const currentMonth = seoulToday().slice(0, 7);
  const folders = withCurrentMonth(groups, currentMonth);
  const openKey = folderView && month && /^\d{4}-\d{2}$/.test(month) ? month : null;
  const homeHref = entryHomePath(pet?.lifeStatus === "memorial" ? "memorial" : "living", pet?.petId ?? null);
  const folderLang = lang === "en" ? "en" : "ko";

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pet) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const files = data.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (!files.length) return;
    setSaving(true);
    setSaveError(false);
    const response = await fetch(`/api/my/pets/${pet.petId}/photos`, { method: "POST", body: data });
    setSaving(false);
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    form.reset();
    setSelected(null);
    await load();
  }

  async function saveVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pet) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("video");
    if (!(file instanceof File) || file.size === 0) return;
    setSaving(true);
    setSaveError(false);
    try {
      data.set("duration", String(await videoDuration(file)));
    } catch {
      setSaving(false);
      setSaveError(true);
      return;
    }
    const response = await fetch(`/api/my/pets/${pet.petId}/videos`, { method: "POST", body: data });
    setSaving(false);
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    form.reset();
    setSelected(null);
    await load();
  }

  async function toggleFavorite(hit: MediaHit) {
    if (!pet || !hit.item.deletable) return;
    const favorite = !hit.item.favorite;
    const response = await fetch(`/api/my/pets/${pet.petId}/memories`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: hit.item.entryId, favorite }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setItems((current) => current.map((item) => (item.entryId === hit.item.entryId ? { ...item, favorite } : item)));
    setSelected((current) => current && current.item.entryId === hit.item.entryId
      ? { ...current, item: { ...current.item, favorite } }
      : current);
  }

  async function remove(hit: MediaHit) {
    if (!pet || !hit.item.deletable) return;
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await fetch(`/api/my/pets/${pet.petId}/memories`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: hit.item.entryId }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setItems((current) => current.filter((item) => item.entryId !== hit.item.entryId));
    setSelected(null);
  }

  const showLandingHero = !folderView && (access === "guest" || (access === "owner" && (!pet || (!loading && !loadError && visible.length === 0 && !favoritesOnly))));

  return (
    <div data-testid="memories-archive" className={`flex h-[100svh] flex-col overflow-hidden bg-[#fffaf1] text-[#3a3428] ${lang === "ko" ? "break-keep" : ""}`}>
      {showLandingHero ? (
        <MemoriesHero
          title="우리 아이의 추억"
          body={EMPTY_COPY}
          preview={localPreview}
          onPick={(file) => {
            if (localPreview) URL.revokeObjectURL(localPreview.url);
            if (!file) {
              setLocalPreview(null);
              return;
            }
            setLocalPreview({
              url: URL.createObjectURL(file),
              kind: file.type.startsWith("video/") ? "video" : "image",
            });
          }}
          pet={pet}
          access={access}
          saving={saving}
          saveError={saveError}
          onSavePhoto={savePhoto}
          onSaveVideo={saveVideo}
        />
      ) : (
      <main className={`min-h-0 w-full flex-1 overflow-y-auto pb-8 pt-5 ${folderView ? "mx-0 max-w-none px-0" : "mx-auto max-w-[430px] px-4"}`}>
        {folderView ? (
          <MonthFolders
            lang={folderLang}
            folders={folders}
            openKey={openKey}
            media={visible}
            petId={pet?.petId ?? null}
            petName={pet?.petName ?? ""}
            homeHref={homeHref}
            loading={loading}
            pets={pets}
            selectedPetId={pet?.petId ?? null}
            onOpen={setSelected}
          />
        ) : null}

        {folderView ? null : <header className="flex items-center gap-3">
          {pet?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <h1 className="st-headline text-[1.7rem] leading-snug text-[#2f3a28]">우리 아이의 추억</h1>
            {pet ? <p className="mt-1 truncate text-sm font-semibold text-[#3a3428]">{pet.petName}{pet.species ? ` · ${pet.species}` : ""}</p> : null}
          </div>
        </header>}

        {!folderView && pets.length > 1 ? (
          <ul className="mt-4 flex gap-2 overflow-x-auto">
            {pets.map((item) => (
              <li key={item.petId}>
                <Link href={memoriesHref(item.petId)} aria-current={item.petId === pet?.petId ? "true" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-[#e4d2b4] bg-[#fffaf1] px-4 text-sm font-semibold text-[#3a452f]">
                  {item.petName}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {!folderView && access === "unavailable" ? (
          <p className="mt-5 px-1 text-sm leading-6 text-[#6b5846]">이 환경에서는 계정 저장이 아직 준비되지 않았어요. 사진은 서버에 올리지 않아요.</p>
        ) : null}
        {!folderView && access === "owner" && pet ? (
          <MediaImportForms
            id="import"
            saving={saving}
            saveError={saveError}
            tone="paper"
            onSavePhoto={savePhoto}
            onSaveVideo={saveVideo}
          />
        ) : null}
        {!folderView && loadError === "login" ? (
          <Link href="/dashboard/living" className="st-btn st-btn-forest mt-4 w-full">홈으로</Link>
        ) : null}
        {!folderView && loadError === "unavailable" ? <p className="mt-4 text-sm leading-6 text-[#6b5846]">이 환경에서는 계정 저장이 아직 준비되지 않았어요.</p> : null}

        {!folderView && access === "owner" && pet && !loading && !loadError ? (
          <div className="mt-4">
            <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`st-btn min-h-11 ${favoritesOnly ? "st-btn-sage" : "st-btn-quiet"}`}>
              즐겨찾기
            </button>
          </div>
        ) : null}

        {!folderView && loading ? <p className="mt-6 text-sm text-[#6b5846]">추억을 불러오는 중이에요.</p> : null}

        {folderView || access !== "owner" || !pet || loading || loadError || visible.length === 0 ? null : (
          <section id="months" data-testid="memories-months" className="mt-6 grid gap-6">
            {groups.map((month) => (
              <div key={month.key}>
                <h2 className="st-headline text-xl text-[#3a452f]">{monthTitle(month.key)}</h2>
                {month.days.map((day) => (
                  <div key={day.key} className="mt-3">
                    <h3 className="text-sm font-semibold text-[#6b5846]">{day.key}</h3>
                    <ul className="mt-2 grid grid-cols-3 gap-1">
                      {visible.filter((hit) => day.items.some((item) => item.entryId === hit.item.entryId)).map((hit) => (
                        <li key={hit.assetId}>
                          <button type="button" onClick={() => setSelected(hit)} className="relative block w-full overflow-hidden bg-[#f8f2e5]">
                            <MediaThumb hit={hit} alt={hit.item.title || pet.petName} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

        {!folderView && access === "owner" && pet && !loading && !loadError && favoritesOnly && media.length && visible.length === 0 ? (
          <p data-testid="memories-empty" className="mt-6 text-sm leading-6 text-[#6b5846]">즐겨찾기한 기록이 아직 없어요.</p>
        ) : null}

        {selected && pet && (!folderView || openKey) ? (
          <section aria-label="기록 상세" className="mt-6 overflow-hidden">
            {selected.kind === "video" ? (
              <video src={selected.url} controls playsInline preload="metadata" className="aspect-square w-full bg-[#1d1916] object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.item.title || pet.petName} className="aspect-square w-full object-cover bg-[#f8f2e5]" />
            )}
            <div className={folderView ? "px-4" : ""}>
              <p className="mt-3 text-sm text-[#6b5846]">{selected.item.happenedOn || selected.item.createdAt.slice(0, 10)}{selected.kind === "video" ? " · 동영상" : ""}{selected.item.favorite ? " · 즐겨찾기" : ""}</p>
              <div className="mt-3 grid gap-2">
                <button type="button" onClick={() => void toggleFavorite(selected)} className="st-btn st-btn-quiet w-full">{selected.item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}</button>
                {selected.kind === "image" ? (
                  <>
                    <Link href={polaroidHrefFromArchive(pet.petId)} className="st-btn st-btn-forest w-full">폴라로이드 만들기</Link>
                    <Link href={beamSceneHref(pet.petId, selected.item.entryId, selected.assetId)} className="st-btn st-btn-quiet w-full">Beam 장면 미리보기</Link>
                  </>
                ) : null}
                {selected.item.deletable ? <button type="button" onClick={() => void remove(selected)} className="st-btn st-btn-quiet w-full">삭제</button> : null}
                <button type="button" onClick={() => setSelected(null)} className="min-h-11 text-sm text-[#6b5846]">닫기</button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
      )}
      <StoryTabbar current="memories" {...storyTabProps(copy, pet?.petId ?? null, access === "owner", pet?.lifeStatus ?? null)} />
    </div>
  );
}

function MemoriesHero({
  title,
  body,
  preview,
  onPick,
  pet,
  access,
  saving,
  saveError,
  onSavePhoto,
  onSaveVideo,
}: {
  title: string;
  body: string;
  preview: { url: string; kind: "image" | "video" } | null;
  onPick: (file: File | null) => void;
  pet: MemoriesPet | null;
  access: "guest" | "owner" | "unavailable";
  saving: boolean;
  saveError: boolean;
  onSavePhoto: (event: FormEvent<HTMLFormElement>) => void;
  onSaveVideo: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const heroSrc = preview?.kind === "image" ? preview.url : pet?.avatarUrl || POSE_ART.shibaHome;

  return (
    <main className="relative min-h-0 w-full flex-1 overflow-hidden">
      {preview?.kind === "video" ? (
        <video src={preview.url} muted playsInline autoPlay loop className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-center" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={heroSrc} alt="" className="absolute inset-0 h-full w-full scale-[1.14] object-cover object-[center_42%]" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#1c1914]/88 via-[#1c1914]/45 to-transparent" />
      <div className="relative z-[1] mx-auto flex h-full w-full max-w-[430px] flex-col justify-end px-4 pb-4 pt-[env(safe-area-inset-top)]">
        <h1 className="st-headline text-balance text-[clamp(1.45rem,6vw,1.85rem)] leading-[1.25] text-[#fffaf1]">{title}</h1>
        {pet ? <p className="mt-1 text-sm font-semibold text-[#f0e6d6]">{pet.petName}{pet.species ? ` · ${pet.species}` : ""}</p> : null}
        <p data-testid="memories-empty" className="mt-2 max-w-[22rem] text-sm leading-5 text-[#f0e6d6]">{body}</p>

        {access === "guest" ? (
          <div className="mt-4 grid gap-2">
            <label className="st-btn st-btn-forest w-full">
              사진·동영상 가져오기
              <input
                type="file"
                accept={`${IMAGE_ACCEPT},${VIDEO_ACCEPT}`}
                className="sr-only"
                onChange={(event) => onPick(event.currentTarget.files?.[0] ?? null)}
              />
            </label>
            <p className="text-xs leading-5 text-[#e8dcc8]">이 브라우저에만 잠시 보여요. 계정에는 저장되지 않아요.</p>
            <Link href="/dashboard/living" className="st-btn st-btn-quiet w-full !bg-[#fffaf1]/92">홈으로</Link>
          </div>
        ) : null}

        {access === "owner" && pet ? (
          <MediaImportForms
            id="import"
            saving={saving}
            saveError={saveError}
            tone="hero"
            onSavePhoto={onSavePhoto}
            onSaveVideo={onSaveVideo}
          />
        ) : null}

        {access === "owner" && !pet ? (
          <Link href="/dashboard/living" className="st-btn st-btn-forest mt-4 w-full">홈으로</Link>
        ) : null}
      </div>
    </main>
  );
}

function MediaImportForms({
  id,
  saving,
  saveError,
  tone,
  onSavePhoto,
  onSaveVideo,
}: {
  id?: string;
  saving: boolean;
  saveError: boolean;
  tone: "paper" | "hero";
  onSavePhoto: (event: FormEvent<HTMLFormElement>) => void;
  onSaveVideo: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const hero = tone === "hero";
  const labelClass = hero ? "text-xs text-[#e8dcc8]" : "text-sm text-[#6b5846]";
  const hintClass = hero ? "text-xs text-[#e8dcc8]" : "text-xs text-[#6b5846]";
  const fieldClass = hero ? "st-field !bg-[#fffaf1]/95" : "st-field";
  const quietBtn = hero
    ? "st-btn w-full border border-[#e8dcc8] !bg-[#fffaf1] font-semibold text-[#3a3428] transition-[background-color,border-color,color] duration-200 hover:!border-[#3a452f] hover:!bg-[#3a452f] hover:!text-[#fff5dc] active:!border-[#2f3a28] active:!bg-[#2f3a28] active:!text-[#fff5dc]"
    : "st-btn w-full border border-[#e4d2b4] bg-[#fff8ec] font-semibold text-[#3a3428] transition-[background-color,border-color,color] duration-200 hover:border-[#3a452f] hover:bg-[#3a452f] hover:text-[#fff5dc] active:border-[#2f3a28] active:bg-[#2f3a28] active:text-[#fff5dc]";
  const actionBtn = hero
    ? "st-btn min-h-12 w-full border border-[#e8dcc8] !bg-[#fffaf1] text-sm font-semibold text-[#3a3428] transition-[background-color,border-color,color] duration-200 hover:!border-[#3a452f] hover:!bg-[#3a452f] hover:!text-[#fff5dc] active:!border-[#2f3a28] active:!bg-[#2f3a28] active:!text-[#fff5dc] has-[:focus]:!border-[#3a452f] has-[:focus]:!bg-[#3a452f] has-[:focus]:!text-[#fff5dc]"
    : "st-btn min-h-12 w-full border border-[#e4d2b4] bg-[#fff8ec] text-sm font-semibold text-[#3a3428] transition-[background-color,border-color,color] duration-200 hover:border-[#3a452f] hover:bg-[#3a452f] hover:text-[#fff5dc] active:border-[#2f3a28] active:bg-[#2f3a28] active:text-[#fff5dc] has-[:focus]:border-[#3a452f] has-[:focus]:bg-[#3a452f] has-[:focus]:text-[#fff5dc]";
  const shootBtn = actionBtn;
  const pickBtn = actionBtn;

  return (
    <div id={id} className={`grid gap-4 ${hero ? "mt-4" : "mt-5"}`}>
      <form onSubmit={onSavePhoto} className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className={shootBtn}>
            사진 바로 찍기
            <input name="photos" type="file" accept={IMAGE_ACCEPT} capture="environment" className="sr-only" />
          </label>
          <label className={pickBtn}>
            사진 가져오기
            <input name="photos" type="file" accept={IMAGE_ACCEPT} className="sr-only" />
          </label>
        </div>
        <label className={`grid gap-1 ${labelClass}`}>
          촬영일
          <input name="memoryDate" type="date" className={fieldClass} />
        </label>
        <button type="submit" disabled={saving} className={quietBtn}>{saving ? "저장 중" : "사진 저장"}</button>
      </form>

      <form onSubmit={onSaveVideo} className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <label className={shootBtn}>
            동영상 바로 찍기
            <input name="video" type="file" accept={VIDEO_ACCEPT} capture="environment" className="sr-only" />
          </label>
          <label className={pickBtn}>
            동영상 가져오기
            <input name="video" type="file" accept={VIDEO_ACCEPT} className="sr-only" />
          </label>
        </div>
        <label className={`grid gap-1 ${labelClass}`}>
          촬영일
          <input name="memoryDate" type="date" className={fieldClass} />
        </label>
        <p className={hintClass}>MP4 · WebM · MOV, 최대 30초 · 50MB</p>
        <button type="submit" disabled={saving} className={quietBtn}>{saving ? "저장 중" : "동영상 저장"}</button>
      </form>

      {saveError ? (
        <p role="alert" className={hero ? "text-sm text-[#ffd7c8]" : "text-sm text-[#8a4b32]"}>
          기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}

function monthTitle(key: string) {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  return `${year}년 ${Number(month)}월`;
}

const FOLDER_COPY = {
  ko: {
    kicker: "함께 만든 이야기",
    back: "뒤로",
    loading: "추억을 불러오는 중이에요.",
    emptyFolder: "아직 담긴 기록이 없어요",
    emptyOpen: "사진이나 동영상을 가져오면 촬영일에 맞춰 이 폴더로 들어와요.",
    importLabel: "기록 가져오기",
    count: (count: number) => `${count}개의 기록`,
  },
  en: {
    kicker: "Grouped by month",
    back: "Back",
    loading: "Gathering memories.",
    emptyFolder: "No memories in this folder yet",
    emptyOpen: "Imported photos and videos land here by the day they were taken.",
    importLabel: "Bring in memories",
    count: (count: number) => (count === 1 ? "1 memory" : `${count} memories`),
  },
} as const;

function MonthFolders({
  lang,
  folders,
  openKey,
  media,
  petId,
  petName,
  homeHref,
  loading,
  pets,
  selectedPetId,
  onOpen,
}: {
  lang: "ko" | "en";
  folders: MonthGroup<MemoryLibraryItem>[];
  openKey: string | null;
  media: MediaHit[];
  petId: string | null;
  petName: string;
  homeHref: string;
  loading: boolean;
  pets: MemoriesPet[];
  selectedPetId: string | null;
  onOpen: (hit: MediaHit) => void;
}) {
  const copy = FOLDER_COPY[lang];
  const open = openKey ? folders.find((folder) => folder.key === openKey) ?? { key: openKey, days: [] } : null;
  const openMedia = open ? media.filter((hit) => timelineMonthKey(hit.item) === open.key) : [];

  if (open) {
    return (
      <section data-testid="memory-folder" className="grid gap-4">
        <div className="flex items-start gap-3 px-4">
          <Link href={memoriesMonthHref(petId)} aria-label={copy.back} className="inline-flex size-11 shrink-0 items-center justify-center text-[#1c1a17]">
            <BackIcon />
          </Link>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm text-[#6b5846]">{copy.kicker}</p>
            <h1 className="mt-1 text-[1.55rem] font-semibold leading-tight text-[#161616]">{folderTitle(open.key, lang)}</h1>
            <p className="mt-2 text-sm text-[#8a7b6b]">{openMedia.length === 0 ? copy.emptyFolder : copy.count(openMedia.length)}</p>
          </div>
        </div>
        {openMedia.length === 0 ? (
          <div className="relative mt-1 min-h-[52svh] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={POSE_ART.shibaHome} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1c1914]/75 via-[#1c1914]/35 to-transparent px-4 pb-5 pt-12">
              <p className="text-sm leading-5 text-[#f0e6d6]">{copy.emptyOpen}</p>
              <Link href={memoriesHref(petId)} className="st-btn st-btn-forest mt-3 w-full">{copy.importLabel}</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 px-4">
            {open.days.map((day) => (
              <div key={day.key}>
                <h2 className="text-sm font-semibold text-[#6b5846]">{day.key}</h2>
                <ul className="mt-2 grid grid-cols-3 gap-1">
                  {media.filter((hit) => day.items.some((item) => item.entryId === hit.item.entryId)).map((hit) => (
                    <li key={hit.assetId}>
                      <button type="button" onClick={() => onOpen(hit)} className="relative block w-full overflow-hidden bg-[#f8f2e5]">
                        <MediaThumb hit={hit} alt={hit.item.title || petName} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section data-testid="memory-folders" className="mx-auto w-full max-w-[430px]">
      <header className="px-4">
        <Link href={homeHref} aria-label={copy.back} className="inline-flex size-11 items-center justify-center text-[#1c1a17]">
          <BackIcon />
        </Link>
        <h1 className="mt-3 max-w-[16rem] text-[clamp(1.7rem,7vw,2.05rem)] font-black uppercase leading-[0.92] tracking-[-0.045em] text-[#161616]">
          Stories<br />we&apos;ve made<br />together
        </h1>
        <p className="mt-3 text-sm text-[#6b5846]">{copy.kicker}</p>
      </header>
      {pets.length > 1 ? (
        <ul className="mt-4 flex gap-2 overflow-x-auto px-4">
          {pets.map((item) => (
            <li key={item.petId}>
              <Link href={memoriesMonthHref(item.petId)} aria-current={item.petId === selectedPetId ? "true" : undefined} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-[#3a452f] underline decoration-[#c6a15a] underline-offset-4">
                {item.petName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? <p className="mt-6 px-4 text-sm text-[#6b5846]">{copy.loading}</p> : (
        <ul className="mt-5 grid gap-0">
          {folders.map((folder) => {
            const folderMedia = media.filter((hit) => timelineMonthKey(hit.item) === folder.key);
            const count = folderMedia.length;
            const cover = folderMedia.find((hit) => hit.kind === "image")?.url ?? POSE_ART.shibaHome;
            return (
              <li key={folder.key}>
                <Link href={memoriesMonthHref(petId, folder.key)} className="relative block min-h-[9.5rem] w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="" className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-[center_40%]" />
                  <span className="absolute inset-0 bg-gradient-to-r from-[#1c1914]/72 via-[#1c1914]/32 to-transparent" />
                  <span className="relative z-[1] flex min-h-[9.5rem] flex-col justify-end px-4 py-4">
                    <span className="text-[1.15rem] font-semibold text-[#fffaf1]">{folderTitle(folder.key, lang)}</span>
                    <span className="mt-1 text-sm text-[#e8dcc8]">{count === 0 ? copy.emptyFolder : copy.count(count)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MediaThumb({ hit, alt }: { hit: MediaHit; alt: string }) {
  if (hit.kind === "video") {
    return (
      <>
        <video src={hit.url} muted playsInline preload="metadata" className="aspect-square w-full object-cover" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#1c1914]/55 px-1.5 py-1 text-[10px] font-semibold text-[#fffaf1]">동영상</span>
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={hit.url} alt={alt} className="aspect-square w-full object-cover" />
  );
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

function withCurrentMonth(groups: MonthGroup<MemoryLibraryItem>[], currentKey: string): MonthGroup<MemoryLibraryItem>[] {
  const known = new Map(groups.map((group) => [group.key, group]));
  if (!known.has(currentKey)) known.set(currentKey, { key: currentKey, days: [] });
  return [...known.values()].sort((left, right) => right.key.localeCompare(left.key));
}

function folderTitle(key: string, lang: "ko" | "en") {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  if (lang === "ko") return `${year}년 ${Number(month)}월`;
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}
