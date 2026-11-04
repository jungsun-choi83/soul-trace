"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { authEntryPath } from "@/lib/auth-redirect";
import {
  beamSceneHref,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  memoriesHref,
  polaroidHrefFromArchive,
  type MemoryLibraryItem,
} from "@/lib/memory-library";
import type { LifeStatus } from "@/lib/pet-first-archive";
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
}: {
  access: "guest" | "owner" | "unavailable";
  pets: MemoriesPet[];
  selectedPetId: string | null;
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
        <header className="flex items-center gap-3">
          {pet?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <h1 className="st-headline text-[1.7rem] leading-snug text-[#2f3a28]">우리 아이의 추억</h1>
            {pet ? <p className="mt-1 truncate text-sm font-semibold text-[#3a3428]">{pet.petName}{pet.species ? ` · ${pet.species}` : ""}</p> : null}
          </div>
        </header>

        {pets.length > 1 ? (
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

        {access === "guest" ? <GuestImport preview={localPreview} onPick={setLocalPreview} /> : null}
        {access === "unavailable" ? (
          <p className="st-card mt-5 px-4 py-4 text-sm leading-6 text-[#6b5846]">이 환경에서는 계정 저장이 아직 준비되지 않았어요. 사진은 서버에 올리지 않아요.</p>
        ) : null}
        {access === "owner" && !pet ? (
          <section className="mt-5">
            <p data-testid="memories-empty" className="text-sm leading-6 text-[#6b5846]">{EMPTY_COPY}</p>
            <Link href="/my/pets/new" className="st-btn st-btn-forest mt-4 w-full">아이 등록하기</Link>
          </section>
        ) : null}
        {access === "owner" && pet ? (
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
        {saveError ? <p role="alert" className="mt-3 text-sm text-[#8a4b32]">사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.</p> : null}
        {loadError === "login" ? (
          <Link href={authEntryPath(memoriesHref(pet?.petId), "signin")} className="st-btn st-btn-forest mt-4 w-full">로그인하고 추억 보기</Link>
        ) : null}
        {loadError === "unavailable" ? <p className="mt-4 text-sm leading-6 text-[#6b5846]">이 환경에서는 계정 저장이 아직 준비되지 않았어요.</p> : null}

        {access === "owner" && pet && !loading && !loadError ? (
          <div className="mt-4">
            <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`st-btn min-h-11 ${favoritesOnly ? "st-btn-sage" : "st-btn-quiet"}`}>
              즐겨찾기
            </button>
          </div>
        ) : null}

        {loading ? <p className="mt-6 text-sm text-[#6b5846]">추억을 불러오는 중이에요.</p> : null}

        {access !== "owner" || !pet || loading || loadError ? null : visible.length === 0 ? (
          <p data-testid="memories-empty" className="mt-6 text-sm leading-6 text-[#6b5846]">
            {favoritesOnly && photos.length ? "즐겨찾기한 사진이 아직 없어요." : EMPTY_COPY}
          </p>
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

        {selected && pet ? (
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
      <Link href={authEntryPath("/memories", "signin")} className="st-btn st-btn-quiet w-full">로그인하고 기록에 저장</Link>
    </section>
  );
}

function monthTitle(key: string) {
  const [year, month] = key.split("-");
  if (!year || !month) return key;
  return `${year}년 ${Number(month)}월`;
}
