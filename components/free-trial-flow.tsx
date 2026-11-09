"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { SoulTraceLogo } from "@/components/storybook/soul-trace-logo";
import { STYLE_ORDER, TRIAL_THEMES, trialPlateSrc, type TrialThemeId } from "@/components/trial-theme-scene";
import { useLocale } from "@/components/locale-provider";
import type { FreeStyle } from "@/lib/pet-free-trial";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

const LABELS: Record<"ko" | "en", Record<FreeStyle, string>> = {
  ko: {
    "gouache-story": "과슈풍",
    "felt-doll": "펠트풍",
    "crayon-diary": "파스텔빈티지",
  },
  en: {
    "gouache-story": "Gouache",
    "felt-doll": "Felt",
    "crayon-diary": "Pastel vintage",
  },
};

const PHOTO_OK = /^image\/(jpeg|png|webp)$/i;

function photoAllowed(file: File) {
  return PHOTO_OK.test(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name));
}

function createIdempotencyKey() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function SceneFrame({ plate, alt, zoom = 1 }: { plate: string | null; alt: string; zoom?: number }) {
  return (
    <div className="relative overflow-hidden bg-[#f6efe6]">
      <div className="origin-center transition-transform duration-200" style={zoom === 1 ? undefined : { transform: `scale(${zoom})` }}>
        {plate ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={plate} alt={alt} className="aspect-video w-full object-cover" />
        ) : (
          <div className="grid aspect-video place-items-center px-4 text-center text-sm text-[#a08b7c]">{alt}</div>
        )}
      </div>
    </div>
  );
}

function Paw() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#e7b3c0]" aria-hidden="true">
      <ellipse cx="7" cy="8" rx="2.1" ry="2.6" />
      <ellipse cx="12" cy="6.2" rx="2.1" ry="2.6" />
      <ellipse cx="17" cy="8" rx="2.1" ry="2.6" />
      <ellipse cx="12" cy="15.2" rx="4.2" ry="3.3" />
    </svg>
  );
}

export function FreeTrialFlow() {
  const { lang } = useLocale();
  const copyLang = lang === "en" ? "en" : "ko";
  const key = useRef("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [style, setStyle] = useState<FreeStyle>("crayon-diary");
  const [occasion, setOccasion] = useState<TrialThemeId>("christmas-village");
  const [themeOpen, setThemeOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<FreeStyle | null>(null);
  const [artwork, setArtwork] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [zoom, setZoom] = useState(1);
  const labels = LABELS[copyLang];
  const occasionLabel = TRIAL_THEMES.find((item) => item.id === occasion)?.[copyLang] ?? "";
  const plate = trialPlateSrc(style, occasion);
  const shown = artwork ?? plate;
  const step = result ? 4 : file ? 2 : 1;
  const steps = copyLang === "ko"
    ? ["사진 업로드", "화풍 선택", "미리보기", "완성"]
    : ["Upload", "Style", "Preview", "Done"];

  function choosePhoto(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!photoAllowed(next) || next.size > 10 * 1024 * 1024) {
      setFile(null);
      setPreview(null);
      setError(copyLang === "ko" ? "JPG, PNG, WEBP 사진만 올릴 수 있어요. 최대 10MB." : "Use a JPG, PNG, or WEBP photo under 10MB.");
      return;
    }
    setError(null);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setArtwork(null);
    setResult(null);
    key.current = "";
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!file || pending) return;
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set("petName", name);
    body.set("style", style);
    if (!key.current) key.current = createIdempotencyKey();
    body.set("idempotencyKey", key.current);
    body.set("occasionId", occasion);
    body.set("photo", file);
    const response = await fetch("/api/try/polaroid", { method: "POST", body });
    const payload = (await response.json().catch(() => null)) as { error?: string; style?: FreeStyle; image?: string } | null;
    setPending(false);
    if (!response.ok || !payload?.image) {
      setError(payload?.error === "exhausted"
        ? (copyLang === "ko" ? "이 아이의 무료 폴라로이드를 이미 사용했어요." : "This pet already used the free polaroid.")
        : copyLang === "ko" ? "지금 만들지 못했어요. 잠시 후 다시 시도해 주세요." : "This could not be made just now. Try again in a moment.");
      return;
    }
    setArtwork(`data:image/jpeg;base64,${payload.image}`);
    setResult(payload.style ?? style);
  }

  return (
    <main className={`min-h-[100svh] overflow-x-clip bg-[#f7f1e8] text-[#5c4636] ${lang === "ko" ? "break-keep" : ""}`}>
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="SoulTrace">
          <SoulTraceLogo className="h-4 w-auto sm:h-5" />
        </Link>
        <ol className="mx-auto hidden min-w-0 items-center gap-2 text-[11px] text-[#b7a898] min-[900px]:flex">
          {steps.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            return (
              <li key={label} className="flex items-center gap-2">
                {index > 0 ? <span className="h-px w-6 bg-[#eadfd2]" /> : null}
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${active ? "bg-[#e7a0b4] text-white" : "bg-[#f3e7dc] text-[#c3b3a4]"}`}>{number}</span>
                <span className={active ? "font-medium text-[#8a5d68]" : ""}>{label}</span>
              </li>
            );
          })}
        </ol>
        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle tone="paper" compact />
          <Link href="/" className="grid h-9 w-9 place-items-center rounded-full border border-[#f0e2d4] bg-white text-sm" aria-label={copyLang === "ko" ? "홈" : "Home"}>⌂</Link>
        </div>
        <ol className="flex w-full min-w-0 items-center justify-between gap-1 text-[11px] text-[#b7a898] min-[900px]:hidden">
          {steps.map((label, index) => {
            const number = index + 1;
            const active = number === step;
            return (
              <li key={label} className="flex min-w-0 items-center gap-1">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${active ? "bg-[#e7a0b4] text-white" : "bg-[#f3e7dc] text-[#c3b3a4]"}`}>{number}</span>
                <span className={`text-[10px] leading-tight ${active ? "font-medium text-[#8a5d68]" : ""}`}>{label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      <form onSubmit={create} className="mx-auto grid w-full min-w-0 max-w-6xl gap-4 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 min-[900px]:grid-cols-[250px_minmax(0,1fr)_230px]">
        <aside className="grid content-start gap-4">
          <section className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(120,80,50,0.05)]">
            <p className="text-xs font-medium text-[#8d7363]">{copyLang === "ko" ? "테마 선택" : "Theme"}</p>
            <button type="button" aria-expanded={themeOpen} onClick={() => setThemeOpen((open) => !open)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#f8f1ea] px-3 py-2 text-left">
              {plate ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={plate} alt="" className="aspect-video h-12 w-auto shrink-0 rounded-xl object-cover" />
              ) : <span className="grid h-12 w-16 place-items-center rounded-xl bg-[#f3e6da] text-[10px] text-[#b08978]">{occasionLabel}</span>}
              <span className="min-w-0 flex-1 text-sm font-medium">{occasionLabel}</span>
              <span aria-hidden="true" className="text-[#c3b3a4]">▾</span>
            </button>
            {themeOpen ? (
              <div className="mt-2 grid gap-1">
                {TRIAL_THEMES.map((item) => (
                  <button key={item.id} type="button" aria-pressed={occasion === item.id} onClick={() => { setOccasion(item.id); setThemeOpen(false); setArtwork(null); setResult(null); key.current = ""; }} className={`rounded-xl px-3 py-2 text-left text-sm ${occasion === item.id ? "bg-[#fde8ee] text-[#8a4d5c]" : "hover:bg-[#f8f1ea]"}`}>
                    {item[copyLang]}
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(120,80,50,0.05)]">
            <p className="text-xs font-medium text-[#8d7363]">{copyLang === "ko" ? "화풍 선택" : "Style"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {STYLE_ORDER.map((item) => {
                const selected = style === item;
                const src = trialPlateSrc(item, occasion) ?? trialPlateSrc(item, "christmas-village");
                return (
                  <button key={item} type="button" aria-pressed={selected} onClick={() => { setStyle(item); setArtwork(null); setResult(null); key.current = ""; }} className={`relative min-w-0 overflow-hidden rounded-2xl border-2 bg-white ${selected ? "border-[#f0b7c4]" : "border-transparent"}`}>
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="aspect-video w-full bg-[#f6efe6] object-cover" />
                    ) : null}
                    {selected ? <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-[#e7a0b4] text-[10px] text-white">✓</span> : null}
                    <span className="block px-1 py-2 text-center text-[11px] font-medium leading-tight">{labels[item]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(120,80,50,0.05)]">
            <p className="text-xs font-medium text-[#8d7363]">{copyLang === "ko" ? "우리 아이 사진 업로드" : "Upload your pet"}</p>
            <label className="mt-3 grid gap-1" htmlFor="trial-pet-name">
              <span className="text-[11px] text-[#a08b7c]">{copyLang === "ko" ? "이름" : "Name"}</span>
              <input id="trial-pet-name" type="text" inputMode="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={40} placeholder={copyLang === "ko" ? "우리 아이 이름" : "Pet name"} className="min-h-11 w-full rounded-xl border border-[#eadfd2] bg-white px-3 text-sm text-[#5c4636] outline-none placeholder:text-[#c3b3a4] focus-visible:border-[#e7a0b4]" />
            </label>
            <button type="button" onClick={() => fileRef.current?.click()} aria-label={preview ? (copyLang === "ko" ? "사진 바꾸기" : "Change photo") : undefined} className="mt-3 grid min-h-24 w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-[#f0d5c4] bg-[#fffaf6] px-3 text-center">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="max-h-72 w-full object-contain" />
              ) : (
                <>
                  <span className="text-sm text-[#c9847a]">{copyLang === "ko" ? "반려동물 사진을 올려주세요" : "Upload a pet photo"}</span>
                  <span className="mt-1 text-[10px] text-[#c3b3a4]">JPG, PNG, WEBP · 10MB</span>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              onChange={(event) => {
                choosePhoto(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </section>
        </aside>

        <section className="grid content-start gap-4">
          <div className="rounded-[28px] bg-white p-4 shadow-[0_16px_40px_rgba(120,80,50,0.06)] sm:p-6">
            <p className="text-sm font-medium">{copyLang === "ko" ? "미리보기" : "Preview"}</p>
            <p className="mt-1 text-xs text-[#a08b7c]">{artwork
              ? (copyLang === "ko" ? `우리 아이가 ${occasionLabel} 그림 속에 들어갔어요.` : `Your pet is drawn into ${occasionLabel}.`)
              : (copyLang === "ko" ? "무료로 만들기를 누르면 우리 아이가 이 화풍으로 다시 그려져 길 위에 들어가요." : "Make it free redraws your pet in this style and places them on the path.")}</p>
            <div className="relative mt-4 overflow-hidden rounded-[24px]">
              <SceneFrame plate={shown} alt={occasionLabel} zoom={zoom} />
              {pending ? <p className="absolute inset-0 grid place-items-center bg-[#fffaf6]/75 text-sm text-[#8a6248]">{copyLang === "ko" ? "화풍에 맞춰 그리는 중" : "Drawing in this style"}</p> : null}
            </div>
            <div className="mx-auto mt-4 flex w-full max-w-xs items-center gap-3 text-[#c9847a]">
              <button type="button" aria-label={copyLang === "ko" ? "축소" : "Zoom out"} onClick={() => setZoom((value) => Math.max(1, Math.round((value - 0.1) * 10) / 10))} className="grid h-8 w-8 place-items-center rounded-full bg-[#f8f1ea]">−</button>
              <input aria-label={copyLang === "ko" ? "확대" : "Zoom"} type="range" min={1} max={1.8} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-[#e7a0b4]" />
              <button type="button" aria-label={copyLang === "ko" ? "확대" : "Zoom in"} onClick={() => setZoom((value) => Math.min(1.8, Math.round((value + 0.1) * 10) / 10))} className="grid h-8 w-8 place-items-center rounded-full bg-[#f8f1ea]">+</button>
              <button type="button" aria-label={copyLang === "ko" ? "원래 크기" : "Reset zoom"} onClick={() => setZoom(1)} className="grid h-8 w-8 place-items-center rounded-full bg-[#f8f1ea] text-xs">↺</button>
            </div>
          </div>
          {error === "이 아이의 무료 폴라로이드를 이미 사용했어요." ? <Link href="/premium" className="rounded-full bg-[#e7a0b4] py-4 text-center text-white">추가 콘텐츠 만들기</Link> : null}
          {error ? <p role="alert" className="text-sm text-[#a14b4b]">{error}</p> : null}
          {artwork ? <a href={artwork} download="soultrace-polaroid.jpg" className="rounded-full border border-[#f0d5c4] bg-white py-4 text-center text-base font-medium text-[#8a6248]">다운로드</a> : null}
          {result ? (
            <Link href="/try/save" className="rounded-full bg-[#e7a0b4] py-4 text-center text-base font-medium text-white shadow-[0_12px_24px_rgba(231,160,180,0.35)]">이 추억 저장하기</Link>
          ) : (
            <button type="submit" disabled={pending || !file} className="rounded-full bg-[#e7a0b4] py-4 text-base font-medium text-white shadow-[0_12px_24px_rgba(231,160,180,0.35)] disabled:opacity-50">
              {pending ? (copyLang === "ko" ? "만드는 중" : "Making") : (copyLang === "ko" ? "✦  무료로 만들기" : "✦  Make it free")}
            </button>
          )}
        </section>

        <aside className="rounded-[28px] bg-white p-4 shadow-[0_16px_40px_rgba(120,80,50,0.06)]">
          <p className="flex items-center gap-1 text-sm font-medium"><Paw />{copyLang === "ko" ? "완성" : "Finished"}</p>
          <div className="mx-auto mt-4 w-full max-w-[210px] rounded-[18px] bg-[#fffdfb] p-3 shadow-[0_10px_24px_rgba(120,80,50,0.08)]">
            <div className="overflow-hidden rounded-[12px]">
              <SceneFrame plate={shown} alt="" />
            </div>
            <p className="mt-3 text-center font-serif text-lg italic text-[#8a6248]">{occasion === "christmas-village" ? "Merry Christmas" : occasionLabel}</p>
            {name.trim() ? <p className="mt-1 text-center text-sm font-medium text-[#8a6248]">{name.trim()}</p> : null}
            <p className="mt-1 text-center text-[#e7b3c0]">♥</p>
          </div>
        </aside>
      </form>
    </main>
  );
}
