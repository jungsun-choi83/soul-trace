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

type PhotoHit = {
  item: MemoryLibraryItem;
  assetId: string;
  url: string;
};

const EMPTY_COPY = "아직 기록한 추억이 없어요. 우리 아이의 첫 사진을 남겨보세요.";

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
  const [selected, setSelected] = useState<PhotoHit | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
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
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const photos = items
    .filter((item) => !isMoodJournalItem(item))
    .flatMap((item) => item.assets
      .filter((asset) => asset.contentType.startsWith("image/"))
      .map((asset) => ({ item, assetId: asset.assetId, url: asset.url })));
  const visible = favoritesOnly ? photos.filter((photo) => photo.item.favorite) : photos;
  const groups = groupLibraryByMonthAndDay(visible.map((photo) => photo.item).filter((item, index, list) => list.findIndex((other) => other.entryId === item.entryId) === index));
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

  async function toggleFavorite(photo: PhotoHit) {
    if (!pet || !photo.item.deletable) return;
    const favorite = !photo.item.favorite;
    const response = await fetch(`/api/my/pets/${pet.petId}/memories`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: photo.item.entryId, favorite }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setItems((current) => current.map((item) => (item.entryId === photo.item.entryId ? { ...item, favorite } : item)));
    setSelected((current) => current && current.item.entryId === photo.item.entryId
      ? { ...current, item: { ...current.item, favorite } }
      : current);
  }

  async function remove(photo: PhotoHit) {
    if (!pet || !photo.item.deletable) return;
    if (!window.confirm(copy.deleteConfirm)) return;
    const response = await fetch(`/api/my/pets/${pet.petId}/memories`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entryId: photo.item.entryId }),
    });
    if (!response.ok) {
      setSaveError(true);
      return;
    }
    setItems((current) => current.filter((item) => item.entryId !== photo.item.entryId));
    setSelected(null);
  }

  return (
    <div data-testid="memories-archive" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5">
        {folderView ? (
          <MonthFolders
            lang={folderLang}
            folders={folders}
            openKey={openKey}
            photos={visible}
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

        {!folderView && access === "guest" ? <GuestImport preview={localPreview} onPick={setLocalPreview} /> : null}
        {!folderView && access === "unavailable" ? (
          <p className="st-card mt-5 px-4 py-4 text-sm leading-6 text-[#6b5846]">이 환경에서는 계정 저장이 아직 준비되지 않았어요. 사진은 서버에 올리지 않아요.</p>
        ) : null}
        {!folderView && access === "owner" && !pet ? (
          <section className="mt-5">
            <p data-testid="memories-empty" className="text-sm leading-6 text-[#6b5846]">{EMPTY_COPY}</p>
          </section>
        ) : null}
        {!folderView && access === "owner" && pet ? (
          <form id="import" onSubmit={savePhoto} className="st-card mt-5 grid gap-3 px-4 py-4">
            <label className="st-btn st-btn-forest w-full">
              사진 가져오기
              <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" />
            </label>
            <label className="grid gap-1 text-sm text-[#6b5846]">
              촬영일
              <input name="memoryDate" type="date" className="st-field" />
            </label>
            <button type="submit" disabled={saving} className="st-btn st-btn-quiet w-full">{saving ? "저장 중" : "이 아이 기록에 저장"}</button>
          </form>
        ) : null}
        {!folderView && saveError ? <p role="alert" className="mt-3 text-sm text-[#8a4b32]">사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.</p> : null}
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

        {folderView || access !== "owner" || !pet || loading || loadError ? null : visible.length === 0 ? (
          <div className="mt-6">
            {favoritesOnly && photos.length ? null : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={POSE_ART.shibaHome} alt="" className="aspect-[4/3] w-full rounded-[22px] bg-[#f6efe2] object-contain object-center" />
            )}
            <p data-testid="memories-empty" className="mt-4 text-sm leading-6 text-[#6b5846]">
              {favoritesOnly && photos.length ? "즐겨찾기한 사진이 아직 없어요." : EMPTY_COPY}
            </p>
          </div>
        ) : (
          <section id="months" data-testid="memories-months" className="mt-6 grid gap-6">
            {groups.map((month) => (
              <div key={month.key}>
                <h2 className="st-headline text-xl text-[#3a452f]">{monthTitle(month.key)}</h2>
                {month.days.map((day) => (
                  <div key={day.key} className="mt-3">
                    <h3 className="text-sm font-semibold text-[#6b5846]">{day.key}</h3>
                    <ul className="mt-2 grid grid-cols-3 gap-2">
                      {visible.filter((photo) => day.items.some((item) => item.entryId === photo.item.entryId)).map((photo) => (
                        <li key={photo.assetId}>
                          <button type="button" onClick={() => setSelected(photo)} className="block w-full overflow-hidden rounded-[14px] bg-[#f8f2e5]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt={photo.item.title || pet.petName} className="aspect-square w-full object-cover" />
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

        {selected && pet && (!folderView || openKey) ? (
          <section aria-label="사진 상세" className="st-card mt-6 px-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={selected.item.title || pet.petName} className="aspect-square w-full rounded-[16px] object-contain bg-[#f8f2e5]" />
            <p className="mt-3 text-sm text-[#6b5846]">{selected.item.happenedOn || selected.item.createdAt.slice(0, 10)}{selected.item.favorite ? " · 즐겨찾기" : ""}</p>
            <div className="mt-3 grid gap-2">
              <button type="button" onClick={() => void toggleFavorite(selected)} className="st-btn st-btn-quiet w-full">즐겨찾기</button>
              <Link href={polaroidHrefFromArchive(pet.petId)} className="st-btn st-btn-forest w-full">폴라로이드 만들기</Link>
              <Link href={beamSceneHref(pet.petId, selected.item.entryId, selected.assetId)} className="st-btn st-btn-quiet w-full">Beam 장면 미리보기</Link>
              {selected.item.deletable ? <button type="button" onClick={() => void remove(selected)} className="st-btn st-btn-quiet w-full">삭제</button> : null}
              <button type="button" onClick={() => setSelected(null)} className="min-h-11 text-sm text-[#6b5846]">닫기</button>
            </div>
          </section>
        ) : null}
      </main>
      <StoryTabbar current="memories" {...storyTabProps(copy, pet?.petId ?? null, access === "owner", pet?.lifeStatus ?? null)} />
    </div>
  );
}

function GuestImport({
  preview,
  onPick,
}: {
  preview: string | null;
  onPick: (url: string | null) => void;
}) {
  return (
    <section className="mt-5 grid gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={POSE_ART.shibaHome} alt="" className="aspect-[4/3] w-full rounded-[22px] bg-[#f6efe2] object-contain object-center" />
      <p data-testid="memories-empty" className="text-sm leading-6 text-[#6b5846]">{EMPTY_COPY}</p>
      <label className="st-btn st-btn-forest w-full">
        사진 가져오기
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            onPick(URL.createObjectURL(file));
          }}
        />
      </label>
      <p className="text-xs leading-5 text-[#6b5846]">이 브라우저에만 잠시 보여요. 계정에는 저장되지 않아요.</p>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="aspect-square w-full rounded-[16px] object-contain bg-[#f8f2e5]" />
      ) : null}
      <Link href="/dashboard/living" className="st-btn st-btn-quiet w-full">홈으로</Link>
    </section>
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
    emptyFolder: "아직 담긴 사진이 없어요",
    emptyOpen: "사진을 가져오면 촬영일에 맞춰 이 폴더로 들어와요.",
    importLabel: "사진 가져오기",
    count: (count: number) => `${count}장의 사진`,
  },
  en: {
    kicker: "Grouped by month",
    back: "Back",
    loading: "Gathering memories.",
    emptyFolder: "No photos in this folder yet",
    emptyOpen: "Imported photos land here by the day they were taken.",
    importLabel: "Bring in photos",
    count: (count: number) => (count === 1 ? "1 photo" : `${count} photos`),
  },
} as const;

function MonthFolders({
  lang,
  folders,
  openKey,
  photos,
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
  photos: PhotoHit[];
  petId: string | null;
  petName: string;
  homeHref: string;
  loading: boolean;
  pets: MemoriesPet[];
  selectedPetId: string | null;
  onOpen: (photo: PhotoHit) => void;
}) {
  const copy = FOLDER_COPY[lang];
  const open = openKey ? folders.find((folder) => folder.key === openKey) ?? { key: openKey, days: [] } : null;
  const openPhotos = open ? photos.filter((photo) => timelineMonthKey(photo.item) === open.key) : [];

  if (open) {
    return (
      <section data-testid="memory-folder" className="grid gap-4">
        <div className="flex items-start gap-3">
          <Link href={memoriesMonthHref(petId)} aria-label={copy.back} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-[#c6a15a] bg-[#fffdf8] text-[#1c1a17]">
            <BackIcon />
          </Link>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm text-[#6b5846]">{copy.kicker}</p>
            <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight text-[#161616] underline decoration-[#161616] underline-offset-[6px]">{folderTitle(open.key, lang)}</h1>
            <p className="mt-2 text-sm text-[#8a7b6b]">{openPhotos.length === 0 ? copy.emptyFolder : copy.count(openPhotos.length)}</p>
          </div>
        </div>
        {openPhotos.length === 0 ? (
          <div className="grid gap-3 pt-2">
            <p className="text-sm leading-6 text-[#6b5846]">{copy.emptyOpen}</p>
            <Link href={memoriesHref(petId)} className="st-btn st-btn-forest w-full">{copy.importLabel}</Link>
          </div>
        ) : (
          <div className="grid gap-5">
            {open.days.map((day) => (
              <div key={day.key}>
                <h2 className="text-sm font-semibold text-[#6b5846]">{day.key}</h2>
                <ul className="mt-2 grid grid-cols-3 gap-2">
                  {photos.filter((photo) => day.items.some((item) => item.entryId === photo.item.entryId)).map((photo) => (
                    <li key={photo.assetId}>
                      <button type="button" onClick={() => onOpen(photo)} className="block w-full overflow-hidden rounded-[14px] bg-[#f8f2e5]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.item.title || petName} className="aspect-square w-full object-cover" />
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
    <section data-testid="memory-folders">
      <header>
        <Link href={homeHref} aria-label={copy.back} className="inline-flex size-12 items-center justify-center rounded-full border border-[#c6a15a] bg-[#fffdf8] text-[#1c1a17]">
          <BackIcon />
        </Link>
        <h1 className="mt-4 max-w-[15.5rem] text-[2.05rem] font-black uppercase leading-[0.92] tracking-[-0.045em] text-[#161616]">
          Stories<br />we&apos;ve made<br />together
        </h1>
        <p className="mt-3 text-sm text-[#6b5846]">{copy.kicker}</p>
      </header>
      {pets.length > 1 ? (
        <ul className="mt-4 flex gap-2 overflow-x-auto">
          {pets.map((item) => (
            <li key={item.petId}>
              <Link href={memoriesMonthHref(item.petId)} aria-current={item.petId === selectedPetId ? "true" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-[#e4d2b4] bg-[#fffaf1] px-4 text-sm font-semibold text-[#3a452f]">
                {item.petName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {loading ? <p className="mt-6 text-sm text-[#6b5846]">{copy.loading}</p> : (
        <ul className="mt-6 grid gap-1">
          {folders.map((folder) => {
            const count = photos.filter((photo) => timelineMonthKey(photo.item) === folder.key).length;
            const featured = folder.key === folders[0]?.key;
            return (
              <li key={folder.key}>
                <Link
                  href={memoriesMonthHref(petId, folder.key)}
                  className={featured
                    ? "flex min-h-[4.75rem] items-center gap-4 rounded-[18px] border border-[#c6a15a] bg-[#fffdf8] px-4 py-3"
                    : "flex min-h-[4.75rem] items-center gap-4 px-2 py-3"}
                >
                  <FolderIcon />
                  <span className="min-w-0">
                    <span className="block text-[1.05rem] font-semibold text-[#1c1a17] underline decoration-[#1c1a17] underline-offset-4">{folderTitle(folder.key, lang)}</span>
                    <span className="mt-1 block text-sm text-[#8a7b6b]">{count === 0 ? copy.emptyFolder : copy.count(count)}</span>
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

function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 56 44" className="size-12 shrink-0">
      <path d="M4 14h16.2l3.4-5.2A3 3 0 0 1 26.1 7H46a4 4 0 0 1 4 4v3H8.2" fill="#e8c98a" stroke="#b8893e" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 16.5h48v17.2a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V16.5Z" fill="#f4e0b2" stroke="#b8893e" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}
