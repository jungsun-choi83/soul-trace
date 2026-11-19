"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { entryHomePath } from "@/lib/entry-branch";
import {
  beamSceneHref,
  groupLibraryByMonthAndDay,
  isMoodJournalItem,
  memoriesCategoryHref,
  memoriesHref,
  memoriesMonthHref,
  type MemoryFolderCategory,
  polaroidHrefFromArchive,
  polaroidLibraryItems,
  type MemoryLibraryItem,
  type SavedPolaroidMemory,
} from "@/lib/memory-library";
import { fetchMyPolaroids, myPolaroidImageUrl } from "@/lib/my-polaroids-client";
import { seoulToday, type LifeStatus } from "@/lib/pet-first-archive";
import { POSE_ART } from "@/lib/pose-art";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";

export type MemoriesPet = {
  petId: string;
  petName: string;
  lifeStatus: LifeStatus;
  species: string | null;
  avatarUrl: string | null;
};

type JourneyLetter = {
  submissionId: string;
  letterId?: string | null;
  title?: string | null;
  content?: string | null;
  locale?: string | null;
  createdAt: string;
};

const CATEGORY_ORDER: MemoryFolderCategory[] = ["photo", "video", "polaroid", "letter"];

const CATEGORY_LABEL = {
  ko: { photo: "사진", video: "영상", polaroid: "폴라로이드", letter: "편지" },
  en: { photo: "Photos", video: "Videos", polaroid: "Polaroids", letter: "Letters" },
} as const;

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
  category = null,
  branch = null,
}: {
  access: "guest" | "owner" | "unavailable";
  pets: MemoriesPet[];
  selectedPetId: string | null;
  view?: "archive" | "months";
  month?: string | null;
  category?: MemoryFolderCategory | null;
  branch?: "living" | "memorial" | null;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const pet = pets.find((item) => item.petId === selectedPetId) ?? null;
  const [items, setItems] = useState<MemoryLibraryItem[]>([]);
  const [letters, setLetters] = useState<JourneyLetter[]>([]);
  const [loading, setLoading] = useState(access === "owner");
  const [loadError, setLoadError] = useState<"login" | "unavailable" | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<MediaHit | null>(null);
  const [localPreview, setLocalPreview] = useState<{ url: string; kind: "image" | "video" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [importDraft, setImportDraft] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (access !== "owner") return;
    const requestId = ++requestRef.current;
    const requestedPetId = pet?.petId ?? null;
    setLoading(true);
    setLoadError(null);
    setItems([]);
    setLetters([]);
    setSelected(null);
    const [response, gallery] = await Promise.all([
      pet ? fetch(`/api/my/pets/${pet.petId}/memories`) : Promise.resolve(null),
      fetchMyPolaroids().catch(() => []),
    ]);
    if (requestId !== requestRef.current) return;
    setLoading(false);
    if (response?.status === 401) {
      setLoadError("login");
      return;
    }
    const body = response?.ok
      ? await response.json() as { timeline?: MemoryLibraryItem[]; polaroids?: SavedPolaroidMemory[]; letters?: JourneyLetter[] }
      : { timeline: [], polaroids: [], letters: [] };
    if (pet && response && !response.ok && gallery.length === 0) {
      setLoadError("unavailable");
      return;
    }
    const timeline = (body.timeline ?? []).map((item) => ({
      ...item,
      place: item.place ?? null,
      favorite: Boolean(item.favorite),
    }));
    const petName = pet?.petName.trim().toLowerCase() ?? "";
    const savedPolaroids = gallery.filter((item) => {
      if (!pet) return true;
      if (item.petId === pet.petId) return true;
      if (!item.petId) return true;
      return petName.length > 0 && item.petName.trim().toLowerCase() === petName;
    });
    const seen = new Set<string>();
    const polaroids = [
      ...polaroidLibraryItems(body.polaroids ?? []),
      ...polaroidLibraryItems(savedPolaroids.map((item) => ({
        resultId: item.resultId,
        petName: item.petName,
        createdAt: item.createdAt,
        imageUrl: myPolaroidImageUrl(item.resultId),
      }))),
    ].filter((item) => {
      if (seen.has(item.entryId)) return false;
      seen.add(item.entryId);
      return true;
    });
    if (requestId !== requestRef.current || (pet?.petId ?? null) !== requestedPetId) return;
    setLetters((body.letters ?? []).filter((letter) => letter.submissionId && letter.createdAt));
    setItems([...timeline, ...polaroids]);
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

  useEffect(() => {
    setSelected(null);
    setImportDraft(false);
    setPendingHref(null);
  }, [category, pet?.petId]);

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
  const folderView = view === "months";
  const homeBranch = pet?.lifeStatus === "memorial" || (branch === "memorial" && pet?.lifeStatus !== "living") ? "memorial" : "living";
  const homeHref = entryHomePath(homeBranch, homeBranch === "memorial" && pet?.lifeStatus === "living" ? null : pet?.petId ?? null);
  const folderLang = lang === "en" ? "en" : "ko";

  function petArchiveHref(petId: string) {
    if (folderView && category) return memoriesCategoryHref(petId, category, homeBranch);
    if (folderView) return memoriesMonthHref(petId, null, homeBranch);
    return memoriesHref(petId);
  }

  function openPet(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!importDraft) return;
    event.preventDefault();
    setPendingHref(href);
  }

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
    setImportDraft(false);
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
    setImportDraft(false);
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

  const showLandingHero = !folderView && (access === "guest" || (access === "owner" && !pet));

  return (
    <div data-testid="memories-archive" className={`scheme-light flex h-[100svh] flex-col overflow-hidden bg-[#e7f0f4] text-[#1e4d3a] ${lang === "ko" ? "break-keep" : ""}`}>
      {showLandingHero ? (
        <MemoriesHero
          title="우리아이의 여정"
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
          homeHref={homeHref}
        />
      ) : (
      <main className={`min-h-0 w-full flex-1 overflow-y-auto pb-8 pt-5 ${folderView ? "mx-0 max-w-none px-0" : "mx-auto max-w-[430px] px-4"}`}>
        {folderView ? (
          <MonthFolders
            lang={folderLang}
            media={visible}
            petId={pet?.petId ?? null}
            petName={pet?.petName ?? ""}
            homeHref={homeHref}
            branch={homeBranch}
            category={category}
            letters={letters}
            loading={loading}
            pets={pets}
            selectedPetId={pet?.petId ?? null}
            onOpen={setSelected}
            onSwitchPet={openPet}
            pendingHref={pendingHref}
            onStay={() => setPendingHref(null)}
          />
        ) : null}

        {folderView ? null : <header className="flex items-center gap-3">
          {pet?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : null}
          <div className="min-w-0">
            <h1 className="st-headline text-[1.7rem] font-semibold leading-snug text-[#1e4d3a]">우리아이의 여정</h1>
            {pet ? <p className="mt-1 truncate text-sm font-medium text-[#1e4d3a]">{pet.petName}{pet.species ? ` · ${pet.species}` : ""}</p> : null}
          </div>
        </header>}

        {!folderView && pets.length > 1 ? (
          <ul className="mt-4 flex gap-2 overflow-x-auto">
            {pets.map((item) => (
              <li key={item.petId}>
                <Link href={petArchiveHref(item.petId)} onClick={(event) => openPet(event, petArchiveHref(item.petId))} aria-current={item.petId === pet?.petId ? "true" : undefined} className="inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-full border border-[#1a332c] bg-[#e6dcce] px-3 text-sm font-semibold text-[#1e4d3a]">
                  <PetChipFace pet={item} />
                  <span className="min-w-0 truncate">{item.petName}</span>
                  {item.species ? <span className="shrink-0 text-xs font-medium text-[#3e6274]">{item.species}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {!folderView && pendingHref ? (
          <DraftSwitch href={pendingHref} lang={lang} onStay={() => setPendingHref(null)} />
        ) : null}

        {!folderView && access === "unavailable" ? (
          <p className="mt-5 px-1 text-sm leading-6 text-[#1e4d3a]">이 환경에서는 계정 저장이 아직 준비되지 않았어요. 사진은 서버에 올리지 않아요.</p>
        ) : null}

        {folderView || access !== "owner" || !pet || loading || loadError ? null : (
          <section id="months" data-testid="memories-months" className="mt-6">
            <CategoryFolderGrid petId={pet.petId} branch={homeBranch} lang={folderLang} hits={visible} letters={letters} />
          </section>
        )}

        {!folderView && access === "owner" && pet ? (
          <MediaImportForms
            id="import"
            saving={saving}
            saveError={saveError}
            tone="paper"
            onSavePhoto={savePhoto}
            onSaveVideo={saveVideo}
            onDraft={setImportDraft}
          />
        ) : null}
        {!folderView && loadError === "login" ? (
          <Link href={homeHref} className="st-btn st-btn-forest mt-4 w-full">홈으로</Link>
        ) : null}
        {!folderView && loadError === "unavailable" ? <p className="mt-4 text-sm leading-6 text-[#1e4d3a]">이 환경에서는 계정 저장이 아직 준비되지 않았어요.</p> : null}

        {!folderView && access === "owner" && pet && !loading && !loadError ? (
          <div className="mt-4">
            <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`st-btn min-h-11 ${favoritesOnly ? "st-btn-sage" : "st-btn-quiet"}`}>
              즐겨찾기
            </button>
          </div>
        ) : null}

        {!folderView && loading ? <p className="mt-6 text-sm text-[#1e4d3a]">추억을 불러오는 중이에요.</p> : null}

        {!folderView && access === "owner" && pet && !loading && !loadError && favoritesOnly && media.length && visible.length === 0 ? (
          <p data-testid="memories-empty" className="mt-6 text-sm leading-6 text-[#1e4d3a]">즐겨찾기한 기록이 아직 없어요.</p>
        ) : null}

        {selected && pet && (!folderView || category) ? (
          <section aria-label="기록 상세" className="mt-6 overflow-hidden">
            {selected.kind === "video" ? (
              <video src={selected.url} controls playsInline preload="metadata" className="aspect-square w-full bg-[#1d1916] object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.item.title || pet.petName} className={selected.item.origin === "polaroid" ? "w-full bg-[#f6ebe3] object-contain" : "aspect-square w-full object-cover bg-[#dce8ef]"} />
            )}
            <div className={folderView ? "px-4" : ""}>
              <p className="mt-3 text-sm text-[#1e4d3a]">{selected.item.happenedOn || selected.item.createdAt.slice(0, 10)}{selected.kind === "video" ? " · 동영상" : ""}{selected.item.origin === "polaroid" ? " · 폴라로이드" : ""}{selected.item.favorite ? " · 즐겨찾기" : ""}</p>
              <div className="mt-3 grid gap-2">
                {selected.item.origin === "polaroid" ? null : (
                  <button type="button" onClick={() => void toggleFavorite(selected)} className="st-btn st-btn-quiet w-full">{selected.item.favorite ? "즐겨찾기 해제" : "즐겨찾기"}</button>
                )}
                {selected.kind === "image" && selected.item.origin !== "polaroid" ? (
                  <>
                    <Link href={polaroidHrefFromArchive(pet.petId)} className="st-btn st-btn-forest w-full">폴라로이드 만들기</Link>
                    <Link href={beamSceneHref(pet.petId, selected.item.entryId, selected.assetId)} className="st-btn st-btn-quiet w-full">Beam 장면 미리보기</Link>
                  </>
                ) : null}
                {selected.item.deletable ? <button type="button" onClick={() => void remove(selected)} className="st-btn st-btn-quiet w-full">삭제</button> : null}
                <button type="button" onClick={() => setSelected(null)} className="min-h-11 text-sm text-[#1e4d3a]">닫기</button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
      )}
      <StoryTabbar current="memories" {...storyTabProps(copy, pet?.petId ?? null, access === "owner", pet?.lifeStatus === "living" || pet?.lifeStatus === "memorial" ? pet.lifeStatus : homeBranch)} />
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
  homeHref,
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
  homeHref: string;
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
      <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#10281f]/88 via-[#10281f]/45 to-transparent" />
      <div className="relative z-[1] mx-auto flex h-full w-full max-w-[430px] flex-col justify-end px-4 pb-4 pt-[env(safe-area-inset-top)]">
        <h1 className="st-headline text-balance text-[clamp(1.45rem,6vw,1.85rem)] leading-[1.25] text-[#f6ebe3]">{title}</h1>
        {pet ? <p className="mt-1 text-sm font-semibold text-[#ead6c4]">{pet.petName}{pet.species ? ` · ${pet.species}` : ""}</p> : null}
        <p data-testid="memories-empty" className="mt-2 max-w-[22rem] text-sm leading-5 text-[#ead6c4]">{body}</p>

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
            <p className="text-xs leading-5 text-[#d9c2b0]">이 브라우저에만 잠시 보여요. 계정에는 저장되지 않아요.</p>
            <Link href={homeHref} className="st-btn st-btn-quiet w-full !bg-[#f6ebe3]/92">홈으로</Link>
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
          <Link href={homeHref} className="st-btn st-btn-forest mt-4 w-full">홈으로</Link>
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
  onDraft,
}: {
  id?: string;
  saving: boolean;
  saveError: boolean;
  tone: "paper" | "hero";
  onSavePhoto: (event: FormEvent<HTMLFormElement>) => void;
  onSaveVideo: (event: FormEvent<HTMLFormElement>) => void;
  onDraft?: (dirty: boolean) => void;
}) {
  const hero = tone === "hero";
  const labelClass = hero ? "text-xs font-medium text-[#1e4d3a]" : "text-sm font-medium text-[#1e4d3a]";
  const hintClass = "text-xs text-[#1e4d3a]";
  const fieldClass = "st-field !border-[#ead6c4] !bg-[#e7f0f4] !text-[#1e4d3a]";
  const quietBtn = "st-btn w-full border border-[#55603a] bg-[#55603a] font-semibold text-[#f6ebe3] hover:bg-[#46502f]";
  const actionBtn = "st-btn min-h-12 w-full border border-[#55603a] bg-[#f6ebe3] text-sm font-semibold text-[#1e4d3a] hover:bg-[#ead6c4]";
  const shootBtn = actionBtn;
  const pickBtn = actionBtn;
  const formCard = hero
    ? "grid gap-3 rounded-[16px] border border-[#ead6c4] bg-[#f6ebe3]/95 p-3"
    : "grid gap-3 rounded-[20px] border border-[#ead6c4] bg-[#f6ebe3] p-3 shadow-[0_12px_24px_-16px_rgba(30,77,58,0.45)]";

  return (
    <div id={id} data-import-forms="" className={`grid gap-3 ${hero ? "mt-4" : "mt-5"}`}>
      <form onSubmit={onSavePhoto} onChange={(event) => onDraft?.(formsHaveDraft(event.currentTarget))} className={formCard}>
        {hero ? null : <p className="text-sm font-semibold text-[#1e4d3a]">사진</p>}
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

      <form onSubmit={onSaveVideo} onChange={(event) => onDraft?.(formsHaveDraft(event.currentTarget))} className={formCard}>
        {hero ? null : <p className="text-sm font-semibold text-[#1e4d3a]">영상</p>}
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

function MemoryFolderLink({
  href,
  title,
  detail,
  cover,
  contain,
}: {
  href: string;
  title: string;
  detail: string;
  cover: string | null;
  contain: boolean;
}) {
  return (
    <Link href={href} className="block min-w-0">
      <span className="relative block aspect-[5/4]">
        <svg viewBox="0 0 200 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path d="M8 38h62l12 16h110v94H8V38z" fill="#ead6c4" />
          <path d="M8 54h184v94H8z" fill="#f6ebe3" stroke="#1e4d3a" strokeWidth="1.6" />
          <path d="M8 38h60l12 16H8z" fill="#1e4d3a" />
        </svg>
        <span className="absolute inset-x-[11%] bottom-[11%] top-[40%] overflow-hidden bg-[#e7f0f4]">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className={contain ? "h-full w-full object-contain" : "h-full w-full object-cover object-center"} />
          ) : null}
        </span>
      </span>
      <span className="mt-2 block truncate text-sm font-semibold text-[#1e4d3a]">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-[#1e4d3a]">{detail}</span>
    </Link>
  );
}

function mediaCategory(hit: MediaHit): Exclude<MemoryFolderCategory, "letter"> | null {
  if (hit.item.origin === "polaroid") return "polaroid";
  if (hit.kind === "video") return "video";
  if (hit.kind === "image") return "photo";
  return null;
}

function letterDay(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return createdAt.slice(0, 10);
  return seoulToday(created);
}

function CategoryFolderGrid({
  petId,
  branch,
  lang,
  hits,
  letters,
  className,
}: {
  petId: string | null;
  branch: "living" | "memorial";
  lang: "ko" | "en";
  hits: MediaHit[];
  letters: JourneyLetter[];
  className?: string;
}) {
  const labels = CATEGORY_LABEL[lang];
  const copy = FOLDER_COPY[lang];
  return (
    <ul className={className ?? "grid grid-cols-2 gap-x-4 gap-y-6"}>
      {CATEGORY_ORDER.map((category) => {
        const count = category === "letter" ? letters.length : hits.filter((hit) => mediaCategory(hit) === category).length;
        const cover = category === "letter" ? null : hits.find((hit) => mediaCategory(hit) === category && hit.kind === "image");
        return (
          <li key={category}>
            <MemoryFolderLink
              href={memoriesCategoryHref(petId, category, branch)}
              title={labels[category]}
              detail={count === 0 ? copy.emptyFolder : copy.count(count)}
              cover={cover?.url ?? null}
              contain={category === "polaroid"}
            />
          </li>
        );
      })}
    </ul>
  );
}

function MonthFolders({
  lang,
  media,
  petId,
  petName,
  homeHref,
  branch,
  category,
  letters,
  loading,
  pets,
  selectedPetId,
  onOpen,
  onSwitchPet,
  pendingHref,
  onStay,
}: {
  lang: "ko" | "en";
  media: MediaHit[];
  petId: string | null;
  petName: string;
  homeHref: string;
  branch: "living" | "memorial";
  category: MemoryFolderCategory | null;
  letters: JourneyLetter[];
  loading: boolean;
  pets: MemoriesPet[];
  selectedPetId: string | null;
  onOpen: (hit: MediaHit) => void;
  onSwitchPet: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  pendingHref: string | null;
  onStay: () => void;
}) {
  const copy = FOLDER_COPY[lang];
  const labels = CATEGORY_LABEL[lang];

  if (category) {
    const categoryHits = category === "letter" ? [] : media.filter((hit) => mediaCategory(hit) === category);
    const months = category === "letter" ? [] : groupLibraryByMonthAndDay(uniqueItems(categoryHits));
    const letterMonths = category === "letter" ? groupLetters(letters) : [];
    const count = category === "letter" ? letters.length : categoryHits.length;
    return (
      <section data-testid="memory-category" className="mx-auto grid w-full max-w-[430px] gap-4">
        <div className="flex items-start gap-3 px-4">
          <Link href={memoriesMonthHref(petId, null, branch)} aria-label={copy.back} className="inline-flex size-11 shrink-0 items-center justify-center text-[#1e4d3a]">
            <BackIcon />
          </Link>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium text-[#3e6274]">{lang === "ko" ? "월별" : "By month"}</p>
            <h1 className="mt-1 text-[1.55rem] font-semibold leading-tight text-[#1e4d3a]">{labels[category]}</h1>
            {petName ? <p className="mt-1 truncate text-sm font-medium text-[#1e4d3a]">{petName}</p> : null}
            <p className="mt-2 text-sm text-[#1e4d3a]">{loading ? copy.loading : count === 0 ? copy.emptyFolder : copy.count(count)}</p>
          </div>
        </div>
        {pets.length > 1 ? <PetSwitchList pets={pets} selectedPetId={selectedPetId} hrefFor={(nextPetId) => memoriesCategoryHref(nextPetId, category, branch)} onSwitchPet={onSwitchPet} /> : null}
        {pendingHref ? <div className="px-4"><DraftSwitch href={pendingHref} lang={lang} onStay={onStay} /></div> : null}
        {loading ? <p className="px-4 text-sm text-[#1e4d3a]">{copy.loading}</p> : null}
        {!loading && count === 0 ? (
          <div className="px-4">
            <p className="text-sm leading-6 text-[#1e4d3a]">{category === "letter" ? (lang === "ko" ? "아직 편지가 없어요." : "No letters yet.") : category === "polaroid" ? (lang === "ko" ? "아직 폴라로이드가 없어요." : "No polaroids yet.") : copy.emptyOpen}</p>
            {category === "photo" || category === "video" ? (
              <Link href={memoriesHref(petId, branch)} className="st-btn st-btn-forest mt-3 w-full">{copy.importLabel}</Link>
            ) : null}
          </div>
        ) : null}
        {!loading && category !== "letter" ? (
          <div className="grid gap-6 px-4">
            {months.map((monthGroup) => (
              <section key={monthGroup.key}>
                <h2 className="text-sm font-semibold text-[#1e4d3a]">{folderTitle(monthGroup.key, lang)}</h2>
                {monthGroup.days.map((day) => (
                  <div key={day.key} className="mt-3">
                    <h3 className="text-xs text-[#1e4d3a]">{day.key}</h3>
                    <ul className="mt-2 grid grid-cols-3 gap-1">
                      {categoryHits.filter((hit) => day.items.some((item) => item.entryId === hit.item.entryId)).map((hit) => (
                        <li key={hit.assetId}>
                          <button type="button" onClick={() => onOpen(hit)} className="relative block w-full overflow-hidden bg-[#f4f0e8]">
                            <MediaThumb hit={hit} alt={hit.item.title || petName} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : null}
        {!loading && category === "letter" ? (
          <div className="grid gap-6 px-4">
            {letterMonths.map((monthGroup) => (
              <section key={monthGroup.key}>
                <h2 className="text-sm font-semibold text-[#1e4d3a]">{folderTitle(monthGroup.key, lang)}</h2>
                {monthGroup.letters.map((letter) => (
                  <article key={letter.submissionId} className="mt-3 border-t border-[#e4dcd0] pt-3">
                    <p className="text-xs text-[#1e4d3a]">{letterDay(letter.createdAt)}</p>
                    <h3 className="mt-1 text-sm font-semibold text-[#1e4d3a]">{letter.title?.trim() || labels.letter}</h3>
                    {letter.content ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#1e4d3a]">{letter.content}</p> : null}
                  </article>
                ))}
              </section>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section data-testid="memory-folders" className="mx-auto w-full max-w-[430px]">
      <header className="px-4">
        <Link href={homeHref} aria-label={copy.back} className="inline-flex size-11 items-center justify-center text-[#1e4d3a]">
          <BackIcon />
        </Link>
        <h1 className="st-headline mt-3 text-[1.7rem] font-semibold text-[#1e4d3a]">
          {lang === "ko" ? "우리아이의 여정" : "Our pet's journey"}
        </h1>
        {petName ? <p className="mt-2 text-sm text-[#1e4d3a]">{petName}</p> : null}
      </header>
      {pets.length > 1 ? <PetSwitchList pets={pets} selectedPetId={selectedPetId} hrefFor={(nextPetId) => memoriesMonthHref(nextPetId, null, branch)} onSwitchPet={onSwitchPet} /> : null}
      {pendingHref ? <div className="px-4"><DraftSwitch href={pendingHref} lang={lang} onStay={onStay} /></div> : null}
      {loading ? <p className="mt-6 px-4 text-sm text-[#1e4d3a]">{copy.loading}</p> : (
        <CategoryFolderGrid petId={petId} branch={branch} lang={lang} hits={media} letters={letters} className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 px-4" />
      )}
    </section>
  );
}

function PetSwitchList({
  pets,
  selectedPetId,
  hrefFor,
  onSwitchPet,
}: {
  pets: MemoriesPet[];
  selectedPetId: string | null;
  hrefFor: (petId: string) => string;
  onSwitchPet: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <ul className="mt-4 flex gap-2 overflow-x-auto px-4">
      {pets.map((item) => {
        const href = hrefFor(item.petId);
        return (
          <li key={item.petId}>
            <Link href={href} onClick={(event) => onSwitchPet(event, href)} aria-current={item.petId === selectedPetId ? "true" : undefined} className="inline-flex min-h-11 max-w-[16rem] items-center gap-2 text-sm font-semibold text-[#1e4d3a]">
              <PetChipFace pet={item} />
              <span className="min-w-0 truncate">{item.petName}</span>
              {item.species ? <span className="shrink-0 text-xs font-medium text-[#3e6274]">{item.species}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function PetChipFace({ pet }: { pet: MemoriesPet }) {
  if (pet.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pet.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={POSE_ART.shibaSpring} alt="" className="size-8 shrink-0 rounded-full bg-[#f6ebe3] object-contain" />
  );
}

function DraftSwitch({ href, lang, onStay }: { href: string; lang: string; onStay: () => void }) {
  const ko = lang !== "en";
  return (
    <div role="group" className="mt-4 grid gap-2 rounded-2xl border border-[#d9c2b0] bg-[#f6ebe3] px-4 py-3">
      <p className="text-sm leading-6 text-[#1e4d3a]">{ko ? "작성 중인 사진이나 영상이 있어요." : "A photo or video is still being added."}</p>
      <button type="button" onClick={onStay} className="st-btn w-full border border-[#55603a] bg-[#f6ebe3] text-[#1e4d3a]">{ko ? "계속 작성" : "Keep writing"}</button>
      <Link href={href} className="st-btn st-btn-forest w-full">{ko ? "작성 내용 버리고 전환" : "Discard and switch"}</Link>
    </div>
  );
}

function formHasDraft(form: HTMLFormElement) {
  const fileChosen = [...form.querySelectorAll<HTMLInputElement>("input[type='file']")].some((input) => (input.files?.length ?? 0) > 0);
  const date = form.querySelector<HTMLInputElement>("input[type='date']")?.value ?? "";
  return fileChosen || date.length > 0;
}

function formsHaveDraft(form: HTMLFormElement) {
  const root = form.closest("[data-import-forms]") ?? form.parentElement;
  const forms = root?.querySelectorAll("form");
  return [...(forms ?? [form])].some((item) => formHasDraft(item));
}

function uniqueItems(hits: MediaHit[]) {
  return hits.map((hit) => hit.item).filter((item, index, list) => list.findIndex((other) => other.entryId === item.entryId) === index);
}

function groupLetters(letters: JourneyLetter[]) {
  const dated = [...letters].sort((left, right) => letterDay(right.createdAt).localeCompare(letterDay(left.createdAt)) || right.createdAt.localeCompare(left.createdAt));
  const months: { key: string; letters: JourneyLetter[] }[] = [];
  for (const letter of dated) {
    const key = letterDay(letter.createdAt).slice(0, 7);
    const last = months[months.length - 1];
    if (!last || last.key !== key) months.push({ key, letters: [letter] });
    else last.letters.push(letter);
  }
  return months;
}

function MediaThumb({ hit, alt }: { hit: MediaHit; alt: string }) {
  if (hit.kind === "video") {
    return (
      <>
        <video src={hit.url} muted playsInline preload="metadata" className="aspect-square w-full object-cover" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#10281f]/55 px-1.5 py-1 text-[10px] font-semibold text-[#f6ebe3]">동영상</span>
      </>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={hit.url} alt={alt} className={hit.item.origin === "polaroid" ? "aspect-square w-full bg-[#f6ebe3] object-contain" : "aspect-square w-full object-cover"} />
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
