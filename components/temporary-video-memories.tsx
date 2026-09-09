"use client";

import { useLocale } from "@/components/locale-provider";
import {
  MAX_TEMPORARY_VIDEO_SECONDS,
  validateTemporaryVideoFile,
} from "@/lib/temporary-video-memory";
import { useEffect, useRef, useState } from "react";

type SelectedVideo = { file: File; url: string };
type VideoMemory = {
  memoryId: string;
  url: string;
  caption: string;
  memoryDate: string | null;
  createdAt: string;
  isFavorite: boolean;
};

export function TemporaryVideoMemories({
  formOpen,
  onCloseForm,
}: {
  formOpen: boolean;
  onCloseForm: () => void;
}) {
  const { lang, t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<SelectedVideo | null>(null);
  const memoriesRef = useRef<VideoMemory[]>([]);
  const [selected, setSelected] = useState<SelectedVideo | null>(null);
  const [memories, setMemories] = useState<VideoMemory[]>([]);
  const [caption, setCaption] = useState("");
  const [memoryDate, setMemoryDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isKorean = lang === "ko";

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    memoriesRef.current = memories;
  }, [memories]);

  useEffect(() => () => {
    if (selectedRef.current) URL.revokeObjectURL(selectedRef.current.url);
    memoriesRef.current.forEach((memory) => URL.revokeObjectURL(memory.url));
  }, []);

  const removeSelected = () => {
    if (selected) URL.revokeObjectURL(selected.url);
    setSelected(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const rejectSelectedPreview = () => {
    if (selected) URL.revokeObjectURL(selected.url);
    setSelected(null);
    setError(t("lifeArchive.videos.previewUnsupported"));
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseVideo = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const validation = validateTemporaryVideoFile(file);
    if (validation) {
      setError(t(`lifeArchive.videos.${validation}`));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (!Number.isFinite(probe.duration) || probe.duration > MAX_TEMPORARY_VIDEO_SECONDS) {
        URL.revokeObjectURL(url);
        setError(t("lifeArchive.videos.tooLong"));
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setSelected((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { file, url };
      });
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setError(t("lifeArchive.videos.previewUnsupported"));
      if (inputRef.current) inputRef.current.value = "";
    };
    probe.src = url;
  };

  const resetForm = () => {
    removeSelected();
    setCaption("");
    setMemoryDate("");
    onCloseForm();
  };

  const saveVideo = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const memory: VideoMemory = {
      memoryId: crypto.randomUUID(),
      url: selected.url,
      caption,
      memoryDate: memoryDate || null,
      createdAt: new Date().toISOString(),
      isFavorite: false,
    };
    setMemories((current) => [memory, ...current]);
    setSelected(null);
    setCaption("");
    setMemoryDate("");
    onCloseForm();
    if (inputRef.current) inputRef.current.value = "";
  };

  const deleteVideo = (memoryId: string) => {
    setMemories((current) => current.filter((memory) => {
      if (memory.memoryId === memoryId) URL.revokeObjectURL(memory.url);
      return memory.memoryId !== memoryId;
    }));
  };

  if (!formOpen && memories.length === 0) return null;

  return (
    <section className={`rounded-3xl border border-[#D4AF37]/25 bg-[#12100E]/80 p-6 shadow-[0_0_50px_rgba(212,175,55,0.06)] sm:p-8 ${isKorean ? "font-ko" : "font-display-en"}`}>
      {formOpen ? (
        <form onSubmit={saveVideo} className="rounded-2xl border border-[#D4AF37]/25 bg-black/35 p-5 sm:p-7">
          <h2 className="text-lg font-light text-[#F5E6C8]">{t("lifeArchive.videos.add")}</h2>
          <p className="mt-2 text-xs leading-relaxed text-[#A99B87]">{t("lifeArchive.videos.temporaryWarning")}</p>
          <label className="mt-5 block text-sm font-light text-[#D9C6A4]">
            {t("lifeArchive.videos.select")}
            <input ref={inputRef} type="file" accept="video/*" onChange={(event) => chooseVideo(event.target.files?.[0])} className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-dashed border-[#D4AF37]/35 bg-[#11100F] px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-[#b89a2e] file:px-4 file:py-2 file:text-black" />
          </label>
          <p className="mt-2 text-xs text-[#8F8578]">{t("lifeArchive.videos.help")}</p>
          {selected ? (
            <div className="mt-5">
              <video src={selected.url} controls playsInline preload="metadata" className="max-h-[28rem] w-full rounded-xl bg-black object-contain" onError={rejectSelectedPreview} />
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={() => inputRef.current?.click()} className="min-h-11 rounded-lg border border-[#D4AF37]/30 px-4 text-sm text-[#D9C6A4]">{t("lifeArchive.videos.replace")}</button>
                <button type="button" onClick={removeSelected} className="min-h-11 rounded-lg border border-white/15 px-4 text-sm text-[#C4B8A8]">{t("lifeArchive.videos.remove")}</button>
              </div>
            </div>
          ) : null}
          <label className="mt-5 block text-sm font-light text-[#D9C6A4]">{t("lifeArchive.videos.caption")}<textarea maxLength={500} rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 text-[#F3EAD8]" /></label>
          <label className="mt-5 block max-w-sm text-sm font-light text-[#D9C6A4]">{t("lifeArchive.memoryForm.date")}<input type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#11100F] px-4 py-3 text-[#F3EAD8]" /></label>
          {error ? <p role="alert" className="mt-4 text-sm text-red-200">{error}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={resetForm} className="min-h-12 rounded-xl border border-white/15 px-5 py-3 text-sm text-[#C4B8A8]">{t("lifeArchive.memoryForm.cancel")}</button><button type="submit" disabled={!selected} className="min-h-12 rounded-xl bg-[#b89a2e] px-6 py-3 text-sm text-black disabled:opacity-45">{t("lifeArchive.videos.save")}</button></div>
        </form>
      ) : null}

      {memories.length ? <div className="space-y-6">
        {memories.map((memory) => <article key={memory.memoryId} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 p-3 sm:p-5">
          <p className="mb-3 text-xs leading-relaxed text-[#A99B87]">{t("lifeArchive.videos.temporaryWarning")}</p>
          <video id={`video-memory-${memory.memoryId}`} src={memory.url} controls playsInline preload="metadata" className="max-h-[32rem] w-full rounded-xl bg-black object-contain" />
          <div className="mt-4 border-t border-[#D4AF37]/20 pt-4">
            {memory.memoryDate ? <p className="text-xs text-[#A99B87]">{new Intl.DateTimeFormat(isKorean ? "ko-KR" : "en-US", { dateStyle: "long" }).format(new Date(`${memory.memoryDate}T00:00:00`))}</p> : null}
            {memory.caption ? <p className="mt-2 whitespace-pre-wrap text-sm leading-[1.75] text-[#CFC5B6]">{memory.caption}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#D9C6A4]"><button type="button" aria-pressed={memory.isFavorite} onClick={() => setMemories((current) => current.map((item) => item.memoryId === memory.memoryId ? { ...item, isFavorite: !item.isFavorite } : item))} className="min-h-11 rounded-lg px-3 hover:bg-[#D4AF37]/10">{memory.isFavorite ? "★" : "☆"} {t("lifeArchive.videos.favorite")}</button><button type="button" onClick={() => void document.getElementById(`video-memory-${memory.memoryId}`)?.requestFullscreen?.()} className="min-h-11 rounded-lg px-3 hover:bg-[#D4AF37]/10">{t("lifeArchive.videos.fullScreen")}</button><button type="button" onClick={() => deleteVideo(memory.memoryId)} className="min-h-11 rounded-lg px-3 text-red-200 hover:bg-red-950/30">{t("lifeArchive.videos.delete")}</button></div>
          </div>
        </article>)}
      </div> : null}
    </section>
  );
}
