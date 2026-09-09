"use client";

/* Blob URLs are browser-owned temporary resources and cannot use Next image optimization. */
/* eslint-disable @next/next/no-img-element */

import { useLocale } from "@/components/locale-provider";
import {
  photoCollageLayoutForCount,
  storedPhotoLayoutForCount,
} from "@/lib/photo-collage-layout";
import {
  clearTemporaryPhotoMoments,
  deleteTemporaryPhotoMoment,
  isSupportedPhoto,
  listTemporaryPhotoMoments,
  MAX_PHOTOS_PER_MOMENT,
  saveTemporaryPhotoMoment,
  updateTemporaryPhotoMoment,
  type PhotoCollageLayout,
  type PhotoDisplayMode,
  type PhotoDisplaySettings,
  type TemporaryPhotoMoment,
} from "@/lib/temporary-photo-archive-indexeddb";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type LegacyMemory = {
  memoryId: string;
  title: string | null;
  story: string;
  memoryDate: string | null;
  createdAt: string;
};

type SelectedPhoto = { id: string; file: File; url: string };
const defaultPhotoSettings = (): PhotoDisplaySettings => ({ mode: "fit", positionX: 50, positionY: 50, zoom: 1 });
type DisplayMoment = TemporaryPhotoMoment & { urls: string[] };

type Props = {
  archiveKey: string;
  legacyMemories: LegacyMemory[];
  onDeleteLegacy: (memoryId: string) => Promise<void>;
  onCountsChange: (moments: number, photos: number, favorites?: number) => void;
  openFormSignal?: number;
  showHeader?: boolean;
  latestOnly?: boolean;
  showAllMemories?: boolean;
  storageMode?: "secure" | "temporary";
};

async function canDecodePhoto(file: File): Promise<boolean> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function TemporaryPhotoMoments({
  archiveKey,
  legacyMemories,
  onDeleteLegacy,
  onCountsChange,
  openFormSignal = 0,
  showHeader = true,
  latestOnly = false,
  showAllMemories = false,
  storageMode = "temporary",
}: Props) {
  const { lang, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<SelectedPhoto[]>([]);
  const displayRef = useRef<DisplayMoment[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<SelectedPhoto[]>([]);
  const [moments, setMoments] = useState<DisplayMoment[]>([]);
  const [caption, setCaption] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [layout, setLayout] = useState<PhotoCollageLayout>("clean-grid");
  const [centerPhotoId, setCenterPhotoId] = useState<string | null>(null);
  const [photoSettings, setPhotoSettings] = useState<Record<string, PhotoDisplaySettings>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState<{ moment: DisplayMoment; index: number } | null>(null);
  const galleryReturnFocus = useRef<HTMLElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisplayMoment | null>(null);
  const [memoryFilter, setMemoryFilter] = useState<"all" | "favorites">("all");
  const [yearFilter, setYearFilter] = useState("all");
  const favoriteScrollRef = useRef<HTMLDivElement>(null);
  const [favoriteScroll, setFavoriteScroll] = useState({ left: false, right: false });
  const isKorean = lang === "ko";
  const visibleMoments = latestOnly ? moments.slice(0, 1) : moments;
  const favoriteMoments = useMemo(
    () => moments.filter((moment) => moment.isFavorite).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [moments],
  );
  const availableYears = useMemo(() => Array.from(new Set(moments.map((moment) => moment.memoryDate?.slice(0, 4) ?? moment.createdAt.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [moments]);
  const allFilteredMoments = useMemo(() => moments
    .filter((moment) => memoryFilter === "all" || moment.isFavorite)
    .filter((moment) => yearFilter === "all" || (moment.memoryDate?.slice(0, 4) ?? moment.createdAt.slice(0, 4)) === yearFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [memoryFilter, moments, yearFilter]);
  const groupedMoments = useMemo(() => {
    const groups = new Map<string, DisplayMoment[]>();
    allFilteredMoments.forEach((moment) => {
      const date = moment.memoryDate ?? moment.createdAt.slice(0, 10);
      const key = /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "unknown";
      groups.set(key, [...(groups.get(key) ?? []), moment]);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [allFilteredMoments]);

  const updateFavoriteScroll = useCallback(() => {
    const element = favoriteScrollRef.current;
    if (!element) return;
    setFavoriteScroll({ left: element.scrollLeft > 2, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    updateFavoriteScroll();
    const element = favoriteScrollRef.current;
    if (!element) return;
    element.addEventListener("scroll", updateFavoriteScroll, { passive: true });
    window.addEventListener("resize", updateFavoriteScroll);
    return () => { element.removeEventListener("scroll", updateFavoriteScroll); window.removeEventListener("resize", updateFavoriteScroll); };
  }, [favoriteMoments.length, updateFavoriteScroll]);

  const publishCounts = useCallback((items: DisplayMoment[]) => {
    onCountsChange(items.length, items.reduce((total, item) => total + item.photos.length, 0), items.filter((item) => item.isFavorite).length);
  }, [onCountsChange]);

  useEffect(() => {
    // Publish derived counts after rendering, never from a state updater.
    publishCounts(moments);
  }, [moments, publishCounts]);

  const loadMoments = useCallback(async () => {
    if (storageMode === "secure") {
      const response = await fetch("/api/life-archive/photos");
      if (!response.ok) throw new Error("photo load failed");
      const payload = await response.json() as { moments: Array<{ moment_id: string; caption: string | null; memory_date: string | null; layout: PhotoCollageLayout; center_photo_id: string | null; is_favorite: boolean; created_at: string; photos: Array<{ photoId: string; url: string }> }> };
      const display = payload.moments.map((moment) => ({ momentId: moment.moment_id, archiveKey, caption: moment.caption ?? "", memoryDate: moment.memory_date, layout: moment.layout, centerPhotoId: moment.center_photo_id, isFavorite: moment.is_favorite, createdAt: moment.created_at, photoIds: moment.photos.map((photo) => photo.photoId), photoSettings: {}, photos: moment.photos.map((photo) => ({ photoId: photo.photoId, momentId: moment.moment_id, name: photo.photoId, type: "image/jpeg", blob: new Blob() })), urls: moment.photos.map((photo) => photo.url) }));
      displayRef.current = display;
      setMoments(display);
      publishCounts(display);
      return;
    }
    const records = await listTemporaryPhotoMoments(archiveKey);
    displayRef.current.forEach((moment) => moment.urls.forEach(URL.revokeObjectURL));
    const display = records.map((moment) => ({
      ...moment,
      urls: moment.photos.map((photo) => URL.createObjectURL(photo.blob)),
    }));
    displayRef.current = display;
    setMoments(display);
    publishCounts(display);
  }, [archiveKey, publishCounts, storageMode]);

  useEffect(() => {
    let active = true;
    (storageMode === "secure" ? fetch("/api/life-archive/photos").then((response) => response.json()).then((payload) => payload.moments.map((moment: { moment_id: string; caption: string | null; memory_date: string | null; layout: PhotoCollageLayout; center_photo_id: string | null; is_favorite: boolean; created_at: string; photos: Array<{ photoId: string; url: string }> }) => ({ momentId: moment.moment_id, archiveKey, caption: moment.caption ?? "", memoryDate: moment.memory_date, layout: moment.layout, centerPhotoId: moment.center_photo_id, isFavorite: moment.is_favorite, createdAt: moment.created_at, photoIds: moment.photos.map((photo) => photo.photoId), photoSettings: {}, photos: moment.photos.map((photo) => ({ photoId: photo.photoId, momentId: moment.moment_id, name: photo.photoId, type: "image/jpeg", blob: new Blob() })), urls: moment.photos.map((photo) => photo.url) }))) : listTemporaryPhotoMoments(archiveKey))
      .then((records: Awaited<ReturnType<typeof listTemporaryPhotoMoments>>) => {
        if (!active) return;
        const display = records.map((moment) => ({
          ...moment,
          urls: moment.photos.map((photo) => URL.createObjectURL(photo.blob)),
        }));
        displayRef.current = display;
        setMoments(display);
        publishCounts(display);
      })
      .catch(() => active && setError(t("lifeArchive.photos.storageError")));
    return () => {
      active = false;
      displayRef.current.forEach((moment) => moment.urls.forEach(URL.revokeObjectURL));
    };
  }, [archiveKey, publishCounts, storageMode, t]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (openFormSignal > 0) setFormOpen(true);
  }, [openFormSignal]);

  useEffect(() => () => {
    selectedRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
  }, []);

  const choosePhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const incoming = Array.from(files);
    if (selected.length + incoming.length > MAX_PHOTOS_PER_MOMENT) {
      setError(t("lifeArchive.photos.tooMany").replace("%COUNT%", String(MAX_PHOTOS_PER_MOMENT)));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (incoming.some((file) => !isSupportedPhoto(file))) {
      setError(t("lifeArchive.photos.unsupported"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    const readable = await Promise.all(incoming.map(canDecodePhoto));
    setBusy(false);
    if (readable.some((valid) => !valid)) {
      setError(t("lifeArchive.photos.unreadable"));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelected((current) => {
      const next = [
        ...current,
        ...incoming.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
      ];
      setLayout(storedPhotoLayoutForCount(next.length));
    setCenterPhotoId((existing) => existing ?? next[0]?.id ?? null);
      setPhotoSettings((currentSettings) => Object.fromEntries(next.map((photo) => [photo.id, currentSettings[photo.id] ?? defaultPhotoSettings()])));
      return next;
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeSelected = (id: string) => {
    setSelected((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      const next = current.filter((photo) => photo.id !== id);
      setLayout(storedPhotoLayoutForCount(next.length));
      setCenterPhotoId((currentCenter) => currentCenter === id ? next[0]?.id ?? null : currentCenter);
      setPhotoSettings((currentSettings) => { const nextSettings = { ...currentSettings }; delete nextSettings[id]; return nextSettings; });
      return next;
    });
  };

  const moveSelected = (index: number, direction: -1 | 1) => {
    setSelected((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updatePhotoSetting = (id: string, update: Partial<PhotoDisplaySettings>) => {
    setPhotoSettings((current) => ({
      ...current,
      [id]: { ...(current[id] ?? defaultPhotoSettings()), ...update },
    }));
  };

  const resetForm = () => {
    selected.forEach((photo) => URL.revokeObjectURL(photo.url));
    setSelected([]);
    setCaption("");
    setMemoryDate("");
    setLayout("clean-grid");
    setCenterPhotoId(null);
    setPhotoSettings({});
    setError(null);
    setFormOpen(false);
  };

  const saveMoment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected.length) {
      setError(t("lifeArchive.photos.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (storageMode === "secure") {
        const form = new FormData();
        selected.forEach((photo) => form.append("photos", photo.file));
        form.set("caption", caption);
        form.set("memoryDate", memoryDate);
        form.set("layout", layout);
        const response = await fetch("/api/life-archive/photos", { method: "POST", body: form });
        if (!response.ok) throw new Error("photo upload failed");
        resetForm();
        await loadMoments();
        return;
      }
      await saveTemporaryPhotoMoment({
        archiveKey,
        caption,
        memoryDate: memoryDate || null,
        files: selected.map((photo) => photo.file),
        layout,
        centerPhotoIndex: layout === "classic-centre"
          ? Math.max(0, selected.findIndex((photo) => photo.id === centerPhotoId))
          : null,
        photoSettings: selected.map((photo) => photoSettings[photo.id] ?? defaultPhotoSettings()),
      });
      resetForm();
      await loadMoments();
    } catch {
      setError(t("lifeArchive.photos.storageError"));
    } finally {
      setBusy(false);
    }
  };

  const deleteMoment = async (momentId: string) => {
    setBusy(true);
    setError(null);
    try {
      if (storageMode === "secure") {
        const response = await fetch("/api/life-archive/photos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ momentId }) });
        if (!response.ok) throw new Error("photo deletion failed");
      } else {
        await deleteTemporaryPhotoMoment(momentId);
      }
      setGallery(null);
      setDeleteTarget(null);
      await loadMoments();
    } catch {
      setError(t("lifeArchive.photos.deleteError"));
    } finally {
      setBusy(false);
    }
  };

  const toggleFavorite = async (moment: DisplayMoment) => {
    setBusy(true);
    setError(null);
    try {
      const isFavorite = !moment.isFavorite;
      if (storageMode === "secure") {
        const response = await fetch("/api/life-archive/photos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ momentId: moment.momentId, isFavorite }) });
        if (!response.ok) throw new Error("favorite update failed");
      } else {
        await updateTemporaryPhotoMoment(moment.momentId, { isFavorite });
      }
      setMoments((current) => {
        return current.map((item) => item.momentId === moment.momentId ? { ...item, isFavorite } : item);
      });
    } catch {
      setError(t("lifeArchive.photos.favoriteError"));
    } finally {
      setBusy(false);
    }
  };

  const downloadMoment = async (moment: DisplayMoment) => {
    setBusy(true);
    setError(null);
    try {
      const cellWidth = 800;
      const cellHeight = 600;
      const columns = moment.photos.length === 1 ? 1 : 2;
      const rows = Math.ceil(moment.photos.length / columns);
      const canvas = document.createElement("canvas");
      canvas.width = cellWidth * columns;
      canvas.height = cellHeight * rows;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas-unavailable");
      context.fillStyle = "#241F1A";
      context.fillRect(0, 0, canvas.width, canvas.height);
      for (let index = 0; index < moment.photos.length; index += 1) {
        const bitmap = await createImageBitmap(moment.photos[index].blob);
        const column = index % columns;
        const row = Math.floor(index / columns);
        const scale = Math.min(cellWidth / bitmap.width, cellHeight / bitmap.height);
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        context.drawImage(bitmap, column * cellWidth + (cellWidth - width) / 2, row * cellHeight + (cellHeight - height) / 2, width, height);
        bitmap.close();
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("download-unavailable");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "life-archive-collage.png";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("lifeArchive.photos.downloadError"));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t("lifeArchive.photos.clearConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      await clearTemporaryPhotoMoments();
      setGallery(null);
      await loadMoments();
    } catch {
      setError(t("lifeArchive.photos.clearError"));
    } finally {
      setBusy(false);
    }
  };

  const totalPhotos = useMemo(
    () => moments.reduce((total, moment) => total + moment.photos.length, 0),
    [moments],
  );

  return (
    <section className="rounded-3xl border border-[#D4AF37]/25 bg-[#0F0E0D]/90 p-6 shadow-[0_0_60px_rgba(212,175,55,0.06)] sm:p-8 md:p-10">
      {showHeader ? <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display-en text-[11px] font-medium uppercase tracking-[0.26em] text-[#D4AF37] sm:text-xs">{t("lifeArchive.archive.title")}</h2>
          <p className={`mt-2 text-sm font-light text-[#8F8578] ${isKorean ? "font-ko" : "font-display-en"}`}>
            {t("lifeArchive.photos.summary")
              .replace("%MOMENTS%", String(moments.length))
              .replace("%PHOTOS%", String(totalPhotos))}
          </p>
        </div>
        <button type="button" aria-expanded={formOpen} onClick={() => setFormOpen((open) => !open)} className={`min-h-14 w-full rounded-xl bg-[#b89a2e] px-5 py-4 text-sm font-light text-black transition hover:bg-[#c9a934] sm:w-auto sm:min-w-48 sm:text-base ${isKorean ? "font-ko" : "font-display-en"}`}>
          <span aria-hidden>＋ </span>{t("lifeArchive.photos.add")}
        </button>
      </div> : null}

      {formOpen ? (
        <form onSubmit={saveMoment} className={`mt-8 rounded-2xl border border-[#D4AF37]/25 bg-black/35 p-5 sm:p-7 ${isKorean ? "font-ko" : "font-display-en"}`}>
          <label className="block text-sm font-light text-[#D9C6A4]">
            {t("lifeArchive.photos.select")}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void choosePhotos(event.target.files)} className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-dashed border-[#D4AF37]/35 bg-[#11100F] px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#b89a2e] file:px-4 file:py-2 file:text-black" />
          </label>
          <p className="mt-2 text-xs font-light text-[#8F8578]">{t("lifeArchive.photos.help").replace("%COUNT%", String(MAX_PHOTOS_PER_MOMENT))}</p>

          {selected.length ? (
            <div className="mt-6">
              <p className="mb-3 text-xs font-light text-[#AFA598]" aria-live="polite">
                {t("lifeArchive.photos.selectedCount")
                  .replace("%SELECTED%", String(selected.length))
                  .replace("%MAX%", String(MAX_PHOTOS_PER_MOMENT))}
              </p>
              <ul className="flex max-w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-3" aria-label={t("lifeArchive.photos.selectedLabel")}>
                {selected.map((photo, index) => (
                  <li key={photo.id} className="w-20 shrink-0 snap-start sm:w-24">
                    <div className="relative h-20 w-20 sm:h-24 sm:w-24">
                      <img src={photo.url} alt={t("lifeArchive.photos.previewAlt").replace("%NUMBER%", String(index + 1))} className="h-full w-full rounded-xl object-cover" />
                      <button
                        type="button"
                        onClick={() => removeSelected(photo.id)}
                        aria-label={`${t("lifeArchive.photos.remove")} ${index + 1}`}
                        className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/90 text-base leading-none text-white shadow-lg hover:bg-red-950"
                      >
                        <span aria-hidden>×</span>
                      </button>
                    </div>
                    <span className="sr-only">{photo.file.name}</span>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <button type="button" disabled={index === 0} onClick={() => moveSelected(index, -1)} className="min-h-9 rounded-lg border border-white/15 text-sm disabled:opacity-30" aria-label={`${t("lifeArchive.photos.moveEarlier")} ${index + 1}`}>←</button>
                      <button type="button" disabled={index === selected.length - 1} onClick={() => moveSelected(index, 1)} className="min-h-9 rounded-lg border border-white/15 text-sm disabled:opacity-30" aria-label={`${t("lifeArchive.photos.moveLater")} ${index + 1}`}>→</button>
                    </div>
                    {layout === "classic-centre" ? (
                      <button
                        type="button"
                        onClick={() => setCenterPhotoId(photo.id)}
                        aria-pressed={centerPhotoId === photo.id}
                        className="mt-1 min-h-9 w-full rounded-lg border border-[#D4AF37]/30 px-1 text-[10px] text-[#D9C6A4] aria-pressed:bg-[#D4AF37] aria-pressed:text-black"
                      >
                        {centerPhotoId === photo.id ? t("lifeArchive.photos.centrePhoto") : t("lifeArchive.photos.chooseCentre")}
                      </button>
                    ) : null}
                    <div className="hidden">
                      {(["fit", "fill"] as PhotoDisplayMode[]).map((mode) => (
                        <button key={mode} type="button" aria-pressed={(photoSettings[photo.id]?.mode ?? "fit") === mode} onClick={() => updatePhotoSetting(photo.id, { mode })} className="min-h-9 rounded-lg border border-[#D4AF37]/25 px-1 text-[10px] text-[#D9C6A4] aria-pressed:bg-[#D4AF37] aria-pressed:text-black">
                          {t(`lifeArchive.photos.${mode === "fit" ? "fitFull" : "fillFrame"}`)}
                        </button>
                      ))}
                    </div>
                    {false && (photoSettings[photo.id]?.mode ?? "fit") === "fill" ? (
                      <>
                      <p className="mt-1 text-[9px] leading-tight text-[#A99B87]">{t("lifeArchive.photos.croppedEdges")}</p>
                      <div className="mt-1 grid grid-cols-3 gap-1">
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { positionY: Math.max(0, (photoSettings[photo.id]?.positionY ?? 50) - 10) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.moveUp")}>↑</button>
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { zoom: Math.min(2, (photoSettings[photo.id]?.zoom ?? 1) + 0.1) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.zoomIn")}>+</button>
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { positionY: Math.min(100, (photoSettings[photo.id]?.positionY ?? 50) + 10) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.moveDown")}>↓</button>
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { positionX: Math.max(0, (photoSettings[photo.id]?.positionX ?? 50) - 10) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.moveLeft")}>←</button>
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { zoom: Math.max(1, (photoSettings[photo.id]?.zoom ?? 1) - 0.1) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.zoomOut")}>−</button>
                        <button type="button" onClick={() => updatePhotoSetting(photo.id, { positionX: Math.min(100, (photoSettings[photo.id]?.positionX ?? 50) + 10) })} className="min-h-8 rounded border border-white/10 text-xs" aria-label={t("lifeArchive.photos.moveRight")}>→</button>
                      </div>
                      </>
                    ) : null}
                  </li>
                ))}
                {selected.length < MAX_PHOTOS_PER_MOMENT ? (
                  <li className="w-20 shrink-0 snap-start sm:w-24">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center rounded-xl border border-dashed border-[#D4AF37]/40 bg-[#11100F] px-2 text-center text-xs font-light text-[#D9C6A4] transition hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/10 sm:h-24 sm:w-24"
                    >
                      <span aria-hidden className="mb-1 text-xl">＋</span>
                      {t("lifeArchive.photos.addMore")}
                    </button>
                  </li>
                ) : null}
              </ul>

              <div className="mx-auto mt-7 max-w-xl">
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[#A99B87]">{t("lifeArchive.photos.collagePreview")}</p>
                <PhotoCollage
                  urls={selected.map((photo) => photo.url)}
                  photoIds={selected.map((photo) => photo.id)}
                  layout={layout}
                  photoSettings={photoSettings}
                  onOpen={() => undefined}
                />
              </div>
            </div>
          ) : null}

          <label className="mt-6 block text-sm font-light text-[#D9C6A4]">
            {t("lifeArchive.photos.caption")}
            <textarea maxLength={500} rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 leading-relaxed text-[#F3EAD8] outline-none focus:border-[#D4AF37]/70" />
          </label>
          <label className="mt-5 block max-w-sm text-sm font-light text-[#D9C6A4]">
            {t("lifeArchive.memoryForm.date")}
            <input type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 text-[#F3EAD8] outline-none focus:border-[#D4AF37]/70" />
          </label>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={resetForm} className="min-h-12 rounded-xl border border-white/15 px-5 py-3 text-sm text-[#C4B8A8]">{t("lifeArchive.memoryForm.cancel")}</button>
            <button type="submit" disabled={busy || !selected.length} className="min-h-12 rounded-xl bg-[#b89a2e] px-6 py-3 text-sm text-black disabled:cursor-not-allowed disabled:opacity-45">{busy ? t("lifeArchive.photos.saving") : t("lifeArchive.photos.save")}</button>
          </div>
        </form>
      ) : null}

      {error ? <p role="alert" className={`mt-5 text-sm text-red-200 ${isKorean ? "font-ko" : "font-display-en"}`}>{error}</p> : null}

      {moments.length === 0 && legacyMemories.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#D4AF37]/20 bg-black/25 px-5 py-12 text-center sm:px-8 sm:py-16">
          <div className="mx-auto h-px w-12 bg-[#D4AF37]/55" aria-hidden />
          <h3 className={`mt-6 text-lg font-light text-[#F3EAD8] sm:text-xl ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.photos.emptyTitle")}</h3>
          <p className={`mx-auto mt-4 max-w-xl text-sm font-extralight leading-[1.9] text-[#AFA598] sm:text-base ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.photos.emptyBody")}</p>
        </div>
      ) : null}

      {visibleMoments.length ? (
        <div className="mt-8 space-y-6">
          {visibleMoments.map((moment) => (
            <article key={moment.momentId} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35">
              <div className="p-3 sm:p-5">
                <PhotoCollage urls={moment.urls} photoIds={moment.photoIds} layout={moment.layout} photoSettings={moment.photoSettings} onOpen={(index, element) => { galleryReturnFocus.current = element; setGallery({ moment, index }); }} />
                <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-t border-[#D4AF37]/20 pt-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "long" }).format(new Date(`${moment.memoryDate ?? moment.createdAt.slice(0, 10)}T00:00:00`))}</p>
                    {moment.caption ? <p className="mt-2 whitespace-pre-wrap text-sm leading-[1.75] text-[#CFC5B6]">{moment.caption}</p> : null}
                  </div>
                  <div className="relative flex items-center gap-1 text-xs text-[#D9C6A4]">
                    <button type="button" disabled={busy} onClick={() => void toggleFavorite(moment)} className="min-h-11 rounded-lg px-2.5 transition hover:bg-[#D4AF37]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-pressed={moment.isFavorite} aria-label={moment.isFavorite ? t("lifeArchive.photos.unfavorite") : t("lifeArchive.photos.favorite")}>{moment.isFavorite ? "♥" : "♡"} <span className="hidden sm:inline">{moment.isFavorite ? t("lifeArchive.photos.unfavorite") : t("lifeArchive.photos.favorite")}</span></button>
                    <button type="button" onClick={(event) => { galleryReturnFocus.current = event.currentTarget; setGallery({ moment, index: 0 }); }} className="min-h-11 rounded-lg px-2.5 transition hover:bg-[#D4AF37]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.photos.fullScreen")}>⛶ <span className="hidden sm:inline">{t("lifeArchive.photos.fullScreen")}</span></button>
                    <button type="button" disabled={busy} onClick={() => void downloadMoment(moment)} className="min-h-11 rounded-lg px-2.5 transition hover:bg-[#D4AF37]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.photos.downloadCollage")}>↓ <span className="hidden sm:inline">{t("lifeArchive.photos.downloadCollage")}</span></button>
                    <button type="button" onClick={() => setDeleteTarget(moment)} className="min-h-11 rounded-lg px-2.5 text-lg text-[#D9C6A4] transition hover:bg-red-950/30 hover:text-red-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.photos.deleteMoment")}>🗑</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {favoriteMoments.length ? (
        <section aria-labelledby="favorite-moments-heading" className="mt-10">
          <div className="flex items-center justify-between gap-3">
            <h2 id="favorite-moments-heading" className={`text-[11px] font-medium uppercase tracking-[0.26em] text-[#D4AF37] sm:text-xs ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.favorites.title")}</h2>
            <div className="hidden gap-2 sm:flex">
              <button type="button" disabled={!favoriteScroll.left} onClick={() => favoriteScrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })} className="min-h-9 min-w-9 rounded-full border border-[#D4AF37]/30 text-[#D9C6A4] disabled:opacity-30" aria-label={t("lifeArchive.favorites.previous")}>‹</button>
              <button type="button" disabled={!favoriteScroll.right} onClick={() => favoriteScrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })} className="min-h-9 min-w-9 rounded-full border border-[#D4AF37]/30 text-[#D9C6A4] disabled:opacity-30" aria-label={t("lifeArchive.favorites.next")}>›</button>
            </div>
          </div>
          <div ref={favoriteScrollRef} className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
            {favoriteMoments.map((moment) => (
              <article key={moment.momentId} className="w-[min(78vw,16rem)] shrink-0 snap-start overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-[#12100E]/90 sm:w-[15rem]">
                <button type="button" onClick={(event) => { galleryReturnFocus.current = event.currentTarget; setGallery({ moment, index: 0 }); }} className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.favorites.open")}>
                  <img src={moment.urls[0]} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="p-4">
                    <p className="text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(`${moment.memoryDate ?? moment.createdAt.slice(0, 10)}T00:00:00`))}</p>
                    {moment.caption ? <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#CFC5B6]">{moment.caption}</p> : null}
                    <p className="mt-3 text-xs text-[#D9C6A4]">{moment.photos.length} {t("lifeArchive.favorites.photos")}</p>
                  </div>
                </button>
                <div className="border-t border-[#D4AF37]/15 px-4 py-2">
                  <button type="button" disabled={busy} onClick={() => void toggleFavorite(moment)} className="min-h-10 text-sm text-[#D4AF37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-pressed="true" aria-label={t("lifeArchive.photos.unfavorite")}>♥ <span className="ml-1">{t("lifeArchive.photos.unfavorite")}</span></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showAllMemories ? (
        <section aria-labelledby="all-memories-heading" className="mt-10">
          <h2 id="all-memories-heading" className={`text-[11px] font-medium uppercase tracking-[0.26em] text-[#D4AF37] sm:text-xs ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.allMemories.title")}</h2>
          <p className={`mt-2 text-sm font-light text-[#A99B87] ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.allMemories.subtitle")}</p>
          <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
            {(["all", "favorites"] as const).map((filter) => <button key={filter} type="button" aria-pressed={memoryFilter === filter} onClick={() => setMemoryFilter(filter)} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs ${memoryFilter === filter ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#F5E6C8]" : "border-white/15 text-[#A99B87]"}`}>{filter === "all" ? t("lifeArchive.allMemories.allMoments") : t("lifeArchive.allMemories.favorites")}</button>)}
            <label className="sr-only" htmlFor="life-archive-year-filter">{t("lifeArchive.allMemories.yearLabel")}</label>
            <select id="life-archive-year-filter" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="min-h-10 shrink-0 rounded-full border border-white/15 bg-[#11100F] px-3 text-xs text-[#D9C6A4]">
              <option value="all">{t("lifeArchive.allMemories.allYears")}</option>
              {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          {groupedMoments.length ? groupedMoments.map(([key, items]) => (
            <div key={key} className="mt-7">
              <h3 className={`text-xs tracking-[0.16em] text-[#A99B87] ${isKorean ? "font-ko" : "font-display-en"}`}>{key === "unknown" ? t("lifeArchive.allMemories.noDate") : new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { year: "numeric", month: "long" }).format(new Date(`${key}-01T00:00:00`)).toUpperCase()}</h3>
              <div className="mt-3 grid gap-5 md:grid-cols-2">
                {items.map((moment) => (
                  <article key={moment.momentId} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-4">
                    <PhotoCollage urls={moment.urls} photoIds={moment.photoIds} layout={moment.layout} photoSettings={moment.photoSettings} onOpen={(index, element) => { galleryReturnFocus.current = element; setGallery({ moment, index }); }} />
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#D4AF37]/20 pt-3">
                      <div className="min-w-0"><p className="text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "medium" }).format(new Date(`${moment.memoryDate ?? moment.createdAt.slice(0, 10)}T00:00:00`))}</p>{moment.caption ? <p className="mt-1 truncate text-sm text-[#CFC5B6]">{moment.caption}</p> : null}<p className="mt-1 text-xs text-[#D9C6A4]">{moment.photos.length} {t("lifeArchive.allMemories.photos")}</p></div>
                      <div className="flex shrink-0 gap-1"><button type="button" disabled={busy} onClick={() => void toggleFavorite(moment)} className="min-h-10 rounded-lg px-2 text-[#D4AF37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-pressed={moment.isFavorite} aria-label={moment.isFavorite ? t("lifeArchive.photos.unfavorite") : t("lifeArchive.photos.favorite")}>{moment.isFavorite ? "♥" : "♡"}</button><button type="button" onClick={(event) => { galleryReturnFocus.current = event.currentTarget; setGallery({ moment, index: 0 }); }} className="min-h-10 rounded-lg px-2 text-[#D9C6A4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.photos.fullScreen")}>⛶</button><button type="button" onClick={() => setDeleteTarget(moment)} className="min-h-10 rounded-lg px-2 text-[#D9C6A4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={t("lifeArchive.photos.deleteMoment")}>🗑</button></div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )) : <div className="mt-5 rounded-xl border border-dashed border-[#D4AF37]/20 px-5 py-8 text-center"><p className="text-sm text-[#AFA598]">{t("lifeArchive.allMemories.noMatch")}</p><button type="button" onClick={() => { setMemoryFilter("all"); setYearFilter("all"); }} className="mt-3 text-xs text-[#D4AF37] underline underline-offset-4">{t("lifeArchive.allMemories.clear")}</button></div>}
        </section>
      ) : null}

      {legacyMemories.length ? (
        <div className="mt-8">
          <p className={`mb-4 text-xs text-[#8F8578] ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.photos.olderTextMemories")}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {legacyMemories.map((memory) => (
              <article key={memory.memoryId} className="rounded-2xl border border-white/10 bg-black/35 p-5 sm:p-6">
                <p className="text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "long" }).format(new Date(`${memory.memoryDate ?? memory.createdAt.slice(0, 10)}T00:00:00`))}</p>
                {memory.title ? <h3 className="mt-3 text-xl text-[#F5E6C8]">{memory.title}</h3> : null}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-[1.85] text-[#CFC5B6]">{memory.story}</p>
                <button type="button" onClick={() => void onDeleteLegacy(memory.memoryId)} className="mt-5 min-h-11 text-xs text-[#8F8578] underline underline-offset-4 hover:text-red-200">{t("lifeArchive.memoryForm.delete")}</button>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {moments.length ? (
        <button type="button" disabled={busy} onClick={() => void clearAll()} className={`mt-8 min-h-11 text-xs text-[#8F8578] underline decoration-white/20 underline-offset-4 hover:text-red-200 ${isKorean ? "font-ko" : "font-display-en"}`}>{t("lifeArchive.photos.clearAll")}</button>
      ) : null}

      {gallery ? <PhotoGallery gallery={gallery} setGallery={setGallery} returnFocus={galleryReturnFocus.current} /> : null}
      {deleteTarget ? (
        <div role="dialog" aria-modal="true" aria-labelledby="delete-moment-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5">
          <div className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#171411] p-6 shadow-2xl sm:p-8">
            <h2 id="delete-moment-title" className="text-lg text-[#F3EAD8]">{t("lifeArchive.photos.deleteMoment")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#CFC5B6]">{t("lifeArchive.photos.deleteConfirm")}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm text-[#D9C6A4]">{t("lifeArchive.photos.cancel")}</button>
              <button type="button" disabled={busy} onClick={() => void deleteMoment(deleteTarget.momentId)} className="min-h-11 rounded-lg bg-red-900/80 px-4 text-sm text-white disabled:opacity-50">{t("lifeArchive.photos.deleteAction")}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PhotoCollage({ urls, photoIds, layout, photoSettings, onOpen }: {
  urls: string[];
  photoIds: string[];
  layout: PhotoCollageLayout;
  photoSettings: Record<string, PhotoDisplaySettings>;
  onOpen: (index: number, element: HTMLButtonElement) => void;
}) {
  const tile = (url: string, index: number, className = "") => (
    <div key={`${url}-${index}`} className={`relative rounded-sm bg-[#E9DDC8] p-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.3)] sm:p-3 ${index % 2 ? "rotate-[1deg]" : "-rotate-[1deg]"} ${className}`}>
      <span className="pointer-events-none absolute -top-2 left-1/2 z-10 h-4 w-12 -translate-x-1/2 rotate-[-2deg] bg-[#C4A66A]/60" aria-hidden />
      <button type="button" onClick={(event) => onOpen(index, event.currentTarget)} className="block w-full overflow-hidden bg-[#241F1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]" aria-label={`Open photo ${index + 1}`}>
        <CollageImage url={url} setting={photoSettings[photoIds[index]]} className="w-full" />
      </button>
    </div>
  );

  const adaptiveLayout = photoCollageLayoutForCount(urls.length);
  const boardClass = "relative mx-auto w-full max-w-[700px] overflow-hidden rounded-xl border border-[#D4AF37]/20 bg-[#33251D] p-4 sm:p-8";
  const decoration = <span className="pointer-events-none absolute right-3 top-2 text-sm text-[#D4AF37]/55 sm:right-5 sm:top-4" aria-hidden>✦ ♡</span>;

  if (adaptiveLayout === "empty") return null;
  if (adaptiveLayout === "hero-frame") return <div data-collage-layout={adaptiveLayout} data-stored-layout={layout} className={boardClass}>{decoration}<div className="mx-auto w-[92%] max-w-[480px] sm:w-[76%]">{tile(urls[0], 0, "sm:-rotate-[1.5deg]")}</div></div>;
  if (adaptiveLayout === "story-pair") return <div data-collage-layout={adaptiveLayout} data-stored-layout={layout} className={`${boardClass} grid grid-cols-2 items-center gap-2 sm:gap-0`}>{decoration}{tile(urls[0], 0, "sm:translate-x-3 sm:-rotate-[3deg]")}{tile(urls[1], 1, "sm:-translate-x-3 sm:translate-y-5 sm:rotate-[3deg]")}</div>;
  if (adaptiveLayout === "polaroid-trio") return <div data-collage-layout={adaptiveLayout} data-stored-layout={layout} className={`${boardClass} grid grid-cols-2 gap-2 sm:gap-0`}>{decoration}{tile(urls[0], 0, "sm:translate-x-5 sm:-rotate-[4deg]")}{tile(urls[1], 1, "sm:-translate-x-5 sm:rotate-[4deg]")}{tile(urls[2], 2, "col-span-2 mx-auto w-[50%] -translate-y-1 sm:w-[43%] sm:-translate-y-7")}</div>;
  if (adaptiveLayout === "scrapbook-stack") return <div data-collage-layout={adaptiveLayout} data-stored-layout={layout} className={`${boardClass} grid grid-cols-2 gap-2 sm:gap-1`}>{decoration}{tile(urls[0], 0, "sm:translate-x-4 sm:rotate-[2deg]")}{tile(urls[1], 1, "sm:-translate-x-2 sm:translate-y-5 sm:-rotate-[3deg]")}{tile(urls[2], 2, "sm:translate-x-2 sm:-translate-y-2 sm:-rotate-[2deg]")}{tile(urls[3], 3, "sm:-translate-x-4 sm:translate-y-2 sm:rotate-[3deg]")}</div>;
  return <div data-collage-layout={adaptiveLayout} data-stored-layout={layout} className={`${boardClass} grid grid-cols-6 gap-2 sm:gap-1`}>{decoration}{tile(urls[0], 0, "col-span-3 sm:translate-x-4 sm:-rotate-[3deg]")}{tile(urls[1], 1, "col-span-3 sm:-translate-x-2 sm:translate-y-4 sm:rotate-[2deg]")}{tile(urls[2], 2, "col-span-2 sm:translate-x-3 sm:-translate-y-2 sm:rotate-[2deg]")}{tile(urls[3], 3, "col-span-2 sm:-translate-y-4 sm:-rotate-[2deg]")}{tile(urls[4], 4, "col-span-2 sm:-translate-x-3 sm:translate-y-1 sm:rotate-[3deg]")}</div>;
}

function CollageImage({ url, className, center = false }: { url: string; setting?: PhotoDisplaySettings; className: string; center?: boolean }) {
  return (
    <span className={`relative block overflow-hidden bg-[#241F1A] ${className}`}>
      <img src={url} alt="" className={`relative block h-auto w-full object-contain ${center ? "rounded-xl" : ""}`} />
    </span>
  );
}

function PhotoGallery({ gallery, setGallery, returnFocus }: {
  gallery: { moment: DisplayMoment; index: number };
  setGallery: React.Dispatch<React.SetStateAction<{ moment: DisplayMoment; index: number } | null>>;
  returnFocus: HTMLElement | null;
}) {
  const { t } = useLocale();
  const { moment, index } = gallery;
  const returnFocusRef = useRef(returnFocus);
  useEffect(() => {
    const opener = returnFocusRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGallery(null);
      if (event.key === "ArrowLeft" && index > 0) setGallery({ moment, index: index - 1 });
      if (event.key === "ArrowRight" && index < moment.urls.length - 1) setGallery({ moment, index: index + 1 });
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [index, moment, setGallery]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t("lifeArchive.photos.galleryLabel")} className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 sm:p-8">
      <button type="button" onClick={() => setGallery(null)} className="absolute right-4 top-4 min-h-11 rounded-lg border border-white/20 px-4 text-sm text-white">{t("lifeArchive.photos.closeGallery")}</button>
      <button type="button" disabled={index === 0} onClick={() => setGallery({ moment, index: index - 1 })} className="absolute left-2 min-h-12 rounded-full bg-black/65 px-4 text-2xl text-white disabled:opacity-20 sm:left-6" aria-label={t("lifeArchive.photos.previousPhoto")}>‹</button>
      <img src={moment.urls[index]} alt={t("lifeArchive.photos.galleryPhotoAlt").replace("%NUMBER%", String(index + 1)).replace("%TOTAL%", String(moment.urls.length))} className="max-h-[82vh] max-w-full object-contain" />
      <button type="button" disabled={index === moment.urls.length - 1} onClick={() => setGallery({ moment, index: index + 1 })} className="absolute right-2 min-h-12 rounded-full bg-black/65 px-4 text-2xl text-white disabled:opacity-20 sm:right-6" aria-label={t("lifeArchive.photos.nextPhoto")}>›</button>
      <p className="absolute bottom-4 text-sm text-white">{index + 1} / {moment.urls.length}</p>
    </div>
  );
}
