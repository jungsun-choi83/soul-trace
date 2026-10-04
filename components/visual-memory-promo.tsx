import Image from "next/image";
import { toPng } from "html-to-image";
import { HiOutlineCloudArrowUp } from "react-icons/hi2";
import { useEffect, useRef, useState } from "react";
import { koreanLetterFont } from "./generated-letter-fonts";
import { LIVING_SCENE_ICONS, MEMORIAL_SCENE_ICONS } from "./visual-memory-scene-icons";

export type VisualMemoryPreviewData = {
  petName: string;
  petType: string;
  breed: string;
  favoriteMemory: string | null;
  uniqueHabit: string | null;
  loveAnswer: string | null;
  excitementSigns: string | null;
  letterTone: string | null;
  mode: string;
  photoAvailable: boolean;
  photoReference: string | null;
  photoPreviewUrl: string | null;
};

export type VisualMemoryGenerationContext = {
  petName: string;
  petType: string;
  breed: string;
  mode: "living" | "memorial";
  letterTone: string;
  memories: Array<{ question: string; answer: string }>;
};

type VisualMemoryPromoProps = {
  language: "ko" | "en";
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  captions: {
    byTheSea: string;
    rightBesideMe: string;
    walk: string;
  };
  previewData: VisualMemoryPreviewData;
  photoFile: File | null;
  generationContext: VisualMemoryGenerationContext;
  previewCopy: {
    title: string;
    intro: string;
    close: string;
    petName: string;
    petType: string;
    breed: string;
    favoriteMemory: string;
    uniqueHabit: string;
    loveAnswer: string;
    excitementSigns: string;
    letterTone: string;
    mode: string;
    petPhoto: string;
    available: string;
    unavailable: string;
    generate: string;
    generating: string;
    retry: string;
    photoStep: string;
    sceneStep: string;
    memoryStep: string;
    resultStep: string;
    uploadPhoto: string;
    changePhoto: string;
    identityReference: string;
    continue: string;
    invalidPhoto: string;
    sceneTitle: string;
    sceneIntro: string;
    back: string;
    creatingTitle: string;
    creatingIntro: string;
    generationError: string;
    resultTitle: string;
    resultIntro: string;
    download: string;
    generateAgain: string;
    regenerating: string;
    chooseDifferentScene: string;
    soulTraceMark: string;
    preparingDownload: string;
    downloadError: string;
    customScene: {
      livingLabel: string;
      livingPlaceholder: string;
      memorialLabel: string;
      memorialPlaceholder: string;
    };
    scenes: Record<string, string>;
    memory: {
      living: {
        title: string;
        intro: string;
        placeholder: string;
        suggestions: string[];
      };
      memorial: {
        title: string;
        intro: string;
        placeholder: string;
        suggestions: string[];
      };
    };
  };
};

type VisualMemoryStep = 1 | 2 | 3 | 4;

type SceneOption = {
  id: string;
};

const LIVING_SCENES: SceneOption[] = [
  { id: "by-the-sea" }, { id: "at-home" }, { id: "on-a-walk" }, { id: "flower-field" },
  { id: "playtime" }, { id: "cozy-bedtime" }, { id: "golden-sunset" }, { id: "custom-scene" },
];

const MEMORIAL_SCENES: SceneOption[] = [
  { id: "favorite-place" }, { id: "at-home" }, { id: "by-the-sea" }, { id: "our-walk" },
  { id: "peaceful-garden" }, { id: "golden-evening" }, { id: "together-again" }, { id: "custom-memory" },
];

const previewCards = [
  {
    src: "/images/beach.jpg",
    caption: "byTheSea" as const,
    className: "md:translate-y-3 md:-rotate-[6deg]",
  },
  {
    src: "/images/old.jpg",
    caption: "rightBesideMe" as const,
    className: "md:z-20 md:rotate-[1deg] md:scale-[1.06]",
  },
  {
    src: "/images/car.jpg",
    caption: "walk" as const,
    className: "md:translate-y-3 md:rotate-[6deg]",
  },
];

function visualMemoryFilename(petName: string): string {
  const safePetName = petName
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return safePetName
    ? `soultrace-${safePetName}-visual-memory.png`
    : "soultrace-visual-memory.png";
}

export function VisualMemoryPromo({
  language,
  eyebrow,
  title,
  description,
  cta,
  captions,
  previewData,
  photoFile,
  generationContext,
  previewCopy,
}: VisualMemoryPromoProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [step, setStep] = useState<VisualMemoryStep>(1);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [customSceneDescription, setCustomSceneDescription] = useState("");
  const [memoryDetail, setMemoryDetail] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(photoFile);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generatedTitle, setGeneratedTitle] = useState("");
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const polaroidRef = useRef<HTMLElement>(null);
  const ownedPhotoUrlRef = useRef<string | null>(null);
  const activePhotoUrl = selectedPhotoUrl ?? (
    selectedPhoto === photoFile ? previewData.photoPreviewUrl : null
  );
  const sceneOptions = generationContext.mode === "living" ? LIVING_SCENES : MEMORIAL_SCENES;
  const sceneIcons = generationContext.mode === "living" ? LIVING_SCENE_ICONS : MEMORIAL_SCENE_ICONS;
  const memoryCopy = previewCopy.memory[generationContext.mode];
  const isCustomScene = selectedSceneId === "custom-scene" || selectedSceneId === "custom-memory";

  useEffect(() => {
    if (!previewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewOpen]);

  useEffect(() => {
    return () => {
      if (ownedPhotoUrlRef.current) URL.revokeObjectURL(ownedPhotoUrlRef.current);
    };
  }, []);

  const selectPhoto = (file: File | null) => {
    if (!file) return;
    const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!supportedTypes.has(file.type.toLowerCase()) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setPhotoError(previewCopy.invalidPhoto);
      return;
    }
    if (ownedPhotoUrlRef.current) URL.revokeObjectURL(ownedPhotoUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    ownedPhotoUrlRef.current = objectUrl;
    setSelectedPhoto(file);
    setSelectedPhotoUrl(objectUrl);
    setPhotoError(null);
  };

  const generateVisualMemory = async () => {
    if (
      !selectedPhoto ||
      !selectedSceneId ||
      !memoryDetail.trim() ||
      (isCustomScene && !customSceneDescription.trim()) ||
      isGenerating
    ) return;

    setIsGenerating(true);
    setGenerationError(null);
    try {
      const formData = new FormData();
      formData.append("photo", selectedPhoto);
      formData.append("selectedSceneId", selectedSceneId);
      formData.append("memoryDetail", memoryDetail.trim());
      formData.append("mode", generationContext.mode);
      if (isCustomScene) formData.append("customSceneDescription", customSceneDescription.trim());
      if (generationContext.petName.trim()) formData.append("petName", generationContext.petName.trim());
      if (generationContext.petType.trim()) formData.append("petType", generationContext.petType.trim());
      if (generationContext.breed.trim()) formData.append("breed", generationContext.breed.trim());

      const response = await fetch("/api/visual-memory", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json() as {
        imageDataUrl?: string;
        title?: string;
        caption?: string;
        error?: string;
      };
      if (!response.ok || !payload.imageDataUrl) {
        throw new Error(payload.error || previewCopy.generationError);
      }

      setGeneratedImageUrl(payload.imageDataUrl);
      setGeneratedTitle(payload.title?.trim() || previewCopy.scenes[selectedSceneId]);
      setGeneratedCaption(payload.caption?.trim() || memoryDetail.trim());
      setStep(4);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : previewCopy.generationError);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadVisualMemory = async () => {
    const polaroid = polaroidRef.current;
    if (!polaroid || !generatedImageUrl || isDownloading) return;

    setIsDownloading(true);
    setDownloadError(null);
    try {
      await document.fonts.ready;
      await Promise.all(
        Array.from(polaroid.querySelectorAll("img")).map(
          (image) => image.decode().catch(() => undefined),
        ),
      );

      const options = {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: "#F4E9D5",
      } as const;
      let dataUrl: string;
      try {
        dataUrl = await toPng(polaroid, { ...options, skipFonts: false });
      } catch {
        dataUrl = await toPng(polaroid, {
          ...options,
          skipFonts: true,
          fontEmbedCSS: "",
        });
      }

      const anchor = document.createElement("a");
      anchor.download = visualMemoryFilename(generationContext.petName);
      anchor.href = dataUrl;
      anchor.click();
    } catch {
      setDownloadError(previewCopy.downloadError);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <section
        aria-labelledby="visual-memory-title"
        className={`relative mx-auto mt-6 w-full max-w-2xl overflow-hidden rounded-2xl border border-[#C7A43A]/40 bg-[#0C0B09] shadow-[0_16px_42px_rgba(0,0,0,0.28)] ${
          language === "ko" ? "font-ko break-keep" : "font-display-en"
        }`}
      >
      <Image
        src="/images/Golden Floral Haze Background.png"
        alt=""
        fill
        sizes="(max-width: 672px) 100vw, 672px"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,4,0.94)_0%,rgba(5,5,4,0.78)_48%,rgba(5,5,4,0.62)_100%)] md:bg-[linear-gradient(90deg,rgba(5,5,4,0.94)_0%,rgba(5,5,4,0.82)_48%,rgba(5,5,4,0.58)_100%)]" />

      <div className="relative z-10 grid grid-cols-1 gap-x-8 px-5 py-7 sm:px-7 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)] md:grid-rows-[auto_auto] md:items-center">
        <div className="md:col-start-1 md:row-start-1">
          <p className="text-[0.68rem] font-medium tracking-[0.24em] text-[#D8B84C]">
            {eyebrow}
          </p>
          <h2
            id="visual-memory-title"
            className="mt-3 whitespace-pre-line text-2xl font-medium leading-[1.18] text-[#F3E8D2] sm:text-[1.75rem]"
          >
            {title}
          </h2>
          <p className="mt-4 text-sm font-light leading-relaxed text-[#C4B8A8]">
            {description}
          </p>
        </div>

        <div className="mx-auto mt-5 flex w-full max-w-[320px] snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:grid md:max-w-none md:grid-cols-3 md:items-start md:gap-1 md:overflow-visible md:px-0 md:pb-0 md:pt-3">
          {previewCards.map((card, index) => (
            <figure
              key={card.src}
              className={`relative w-[44vw] max-w-[150px] shrink-0 snap-center rounded-[3px] bg-[#F4E9D5] p-2 pb-3 shadow-[0_14px_30px_rgba(0,0,0,0.48)] md:w-full md:max-w-none md:shrink ${card.className}`}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#171511]">
                <Image
                  src={index === 1 && generatedImageUrl ? generatedImageUrl : card.src}
                  alt=""
                  fill
                  unoptimized={index === 1 && generatedImageUrl !== null}
                  sizes="(max-width: 767px) 170px, 155px"
                  className="object-cover"
                />
              </div>
              <figcaption className="flex min-h-9 flex-col items-center justify-center px-1 pt-2 text-center font-serif text-xs italic leading-tight text-[#292219]">
                {captions[card.caption].split("\n").map((line) => (
                  <span key={`${card.caption}-${line}`}>{line}</span>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="mt-2 inline-flex w-fit items-center justify-center rounded-full border border-[#D8B84C]/80 bg-[#D8B84C] px-5 py-2.5 text-sm font-medium text-[#17130B] shadow-[0_8px_22px_rgba(216,184,76,0.16)] md:col-start-1 md:row-start-2 md:mt-6"
        >
          {cta}
        </button>
      </div>
      </section>

      {previewOpen ? (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm ${
            language === "ko" ? "font-ko" : "font-display-en"
          }`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="visual-memory-preview-title"
            className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-[#C7A43A]/45 bg-[#0C0B09] text-[#F3E8D2] shadow-[0_24px_80px_rgba(0,0,0,0.65)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
              step === 4 ? "max-w-5xl p-5 sm:p-7 lg:p-9" : "max-w-xl p-5 sm:p-7"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-medium tracking-[0.22em] text-[#D8B84C]">
                  VISUAL MEMORY
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                aria-label={previewCopy.close}
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#C7A43A]/35 text-xl text-[#D8B84C] transition hover:bg-[#D8B84C]/10"
              >
                ×
              </button>
            </div>

            <ol
              aria-label="Visual Memory progress"
              className={`grid grid-cols-4 text-center ${
                step === 4
                  ? "mt-4 gap-1 text-[0.6rem] text-[#8C8174] sm:gap-2 sm:text-[0.68rem]"
                  : "mt-5 gap-1.5 text-[0.66rem] sm:gap-3 sm:text-xs"
              }`}
            >
              {[previewCopy.photoStep, previewCopy.sceneStep, previewCopy.memoryStep, previewCopy.resultStep].map(
                (stepLabel, index) => {
                  const stepNumber = index + 1;
                  const isActive = step === stepNumber;
                  const isComplete = step > stepNumber;

                  return (
                  <li key={stepLabel} className={isActive || isComplete ? "text-[#D8B84C]" : "text-[#746B60]"}>
                    <span
                      className={`mx-auto grid place-items-center rounded-full border ${
                        step === 4 ? "mb-1 size-5 text-[0.6rem]" : "mb-1.5 size-7"
                      } ${
                        isActive
                          ? "border-[#D8B84C] bg-[#D8B84C] text-[#17130B]"
                          : isComplete
                            ? "border-[#D8B84C] bg-[#D8B84C]/10 text-[#D8B84C]"
                          : "border-white/15 bg-white/[0.025]"
                      }`}
                    >
                      {isComplete ? "✓" : stepNumber}
                    </span>
                    {stepLabel}
                  </li>
                  );
                },
              )}
            </ol>

            {step === 1 ? (
              <>
            <h2 id="visual-memory-preview-title" className="mt-7 text-xl font-medium sm:text-2xl">
              {previewCopy.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#C4B8A8]">{previewCopy.intro}</p>

            <div className="mt-6">
              <input
                ref={photoInputRef}
                id="visual-memory-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(event) => {
                  selectPhoto(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />

              {selectedPhoto && activePhotoUrl ? (
                <div className="rounded-2xl border border-[#C7A43A]/35 bg-black/35 p-3 sm:p-4">
                  <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl bg-black">
                    <Image
                      src={activePhotoUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) calc(100vw - 72px), 384px"
                      className="object-contain"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="mx-auto mt-4 block text-sm font-medium text-[#D8B84C] underline decoration-[#D8B84C]/40 underline-offset-4"
                  >
                    {previewCopy.changePhoto}
                  </button>
                  <p className="mt-3 text-center text-sm leading-relaxed text-[#C4B8A8]">
                    {previewCopy.identityReference}
                  </p>
                </div>
              ) : (
                <label
                  htmlFor="visual-memory-photo"
                  className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#C7A43A]/45 bg-white/[0.025] px-5 text-center transition hover:border-[#D8B84C] hover:bg-[#D8B84C]/[0.045] sm:min-h-64"
                >
                  <span className="grid size-12 place-items-center rounded-full border border-[#C7A43A]/35 text-[#D8B84C]" aria-hidden="true">
                    <HiOutlineCloudArrowUp className="size-6" />
                  </span>
                  <span className="mt-4 text-sm font-medium text-[#F3E8D2]">{previewCopy.uploadPhoto}</span>
                  <span className="mt-2 text-xs text-[#8F8477]">JPG, JPEG, PNG, WebP · 10 MB</span>
                </label>
              )}

              {photoError ? (
                <p role="alert" className="mt-3 text-center text-sm text-[#E6A59A]">{photoError}</p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!selectedPhoto}
              onClick={() => {
                if (selectedPhoto) setStep(2);
              }}
              className="mt-5 inline-flex w-full items-center justify-center rounded-full border border-[#D8B84C]/80 bg-[#D8B84C] px-5 py-3 text-sm font-medium text-[#17130B] shadow-[0_8px_22px_rgba(216,184,76,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {previewCopy.continue}
            </button>
              </>
            ) : step === 2 ? (
              <>
                <h2 id="visual-memory-preview-title" className="mt-7 text-xl font-medium sm:text-2xl">
                  {previewCopy.sceneTitle}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#C4B8A8]">{previewCopy.sceneIntro}</p>

                <div className="relative mt-6">
                  <div
                    className="pointer-events-none absolute inset-x-[8%] top-[8%] h-[70%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(210,165,72,0.11),rgba(210,165,72,0.025)_48%,transparent_72%)] blur-2xl"
                    aria-hidden="true"
                  />
                  <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">
                    {sceneOptions.map((scene) => {
                      const isSelected = selectedSceneId === scene.id;
                      const SceneIcon = sceneIcons[scene.id];
                      return (
                      <button
                        key={scene.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedSceneId(scene.id)}
                        className={`group relative flex min-h-[164px] flex-col items-center justify-between overflow-hidden rounded-[18px] border px-3 pb-3 pt-4 text-center transition-[transform,border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F0CE72] md:hover:-translate-y-0.5 ${
                          isSelected
                            ? "border-[#F1CC68] bg-[linear-gradient(155deg,rgba(71,55,28,0.72),rgba(20,17,14,0.96))] shadow-[0_0_0_1px_rgba(240,199,92,0.18),0_0_25px_rgba(221,168,55,0.2),0_12px_28px_rgba(0,0,0,0.32)]"
                            : "border-[#AD8743]/50 bg-[linear-gradient(155deg,rgba(37,31,24,0.82),rgba(12,11,10,0.96))] shadow-[inset_0_1px_0_rgba(255,235,184,0.035),0_9px_22px_rgba(0,0,0,0.24)] md:hover:border-[#D4AA55]/75 md:hover:shadow-[0_0_20px_rgba(208,156,52,0.12),0_12px_26px_rgba(0,0,0,0.28)]"
                        }`}
                      >
                        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,217,127,0.055),transparent_55%)]" aria-hidden="true" />
                        <span className={`relative flex h-[104px] w-full items-center justify-center transition-[filter] duration-200 ${isSelected ? "brightness-110 drop-shadow-[0_0_11px_rgba(239,195,91,0.3)]" : "drop-shadow-[0_0_7px_rgba(210,160,68,0.12)] md:group-hover:brightness-105"}`}>
                          {SceneIcon ? <SceneIcon className="h-[82px] w-[98px] max-w-full" /> : null}
                          {isSelected ? (
                            <span className="absolute -right-0.5 -top-1.5 grid size-6 place-items-center rounded-full border border-[#FFE9A5]/50 bg-[#E5BA55] text-xs font-bold text-[#17130B] shadow-[0_0_12px_rgba(236,193,93,0.48)]" aria-hidden="true">
                              ✓
                            </span>
                          ) : null}
                        </span>
                        <span className="relative flex min-h-8 items-center justify-center text-xs font-medium leading-snug tracking-normal text-[#F5E9D3] sm:text-[13px]">
                          {previewCopy.scenes[scene.id]}
                        </span>
                      </button>
                      );
                    })}
                  </div>
                </div>

                {isCustomScene ? (
                  <div className="mt-5">
                    <label htmlFor="visual-memory-custom-scene" className="block text-sm font-medium text-[#E7D8BC]">
                      {generationContext.mode === "living"
                        ? previewCopy.customScene.livingLabel
                        : previewCopy.customScene.memorialLabel}
                    </label>
                    <input
                      id="visual-memory-custom-scene"
                      type="text"
                      value={customSceneDescription}
                      maxLength={160}
                      onChange={(event) => setCustomSceneDescription(event.target.value.slice(0, 160))}
                      placeholder={generationContext.mode === "living"
                        ? previewCopy.customScene.livingPlaceholder
                        : previewCopy.customScene.memorialPlaceholder}
                      className="mt-2 w-full rounded-xl border border-[#C7A43A]/35 bg-black/35 px-4 py-3 text-sm text-[#F3E8D2] outline-none transition placeholder:text-[#746B60] focus:border-[#D8B84C] focus:ring-1 focus:ring-[#D8B84C]/50"
                    />
                    <p className="mt-1.5 text-right text-xs tabular-nums text-[#8F8477]">
                      {customSceneDescription.length}/160
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center justify-center rounded-full border border-[#C7A43A]/55 bg-transparent px-5 py-3 text-sm font-medium text-[#D8B84C] transition hover:bg-[#D8B84C]/10"
                  >
                    {previewCopy.back}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSceneId || (isCustomScene && !customSceneDescription.trim())}
                    onClick={() => {
                      if (selectedSceneId && (!isCustomScene || customSceneDescription.trim())) setStep(3);
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-[#D8B84C]/80 bg-[#D8B84C] px-5 py-3 text-sm font-medium text-[#17130B] shadow-[0_8px_22px_rgba(216,184,76,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {previewCopy.continue}
                  </button>
                </div>
              </>
            ) : step === 3 ? (
              <>
                <h2 id="visual-memory-preview-title" className="mt-7 text-xl font-medium tracking-normal text-[#F3E8D2] sm:text-2xl">
                  {memoryCopy.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed tracking-normal text-[#CFC2AE]">{memoryCopy.intro}</p>

                <div className="mt-5">
                  <textarea
                    value={memoryDetail}
                    onChange={(event) => setMemoryDetail(event.target.value.slice(0, 200))}
                    maxLength={200}
                    rows={4}
                    disabled={isGenerating}
                    aria-label={memoryCopy.title}
                    placeholder={memoryCopy.placeholder}
                    className="w-full resize-none rounded-2xl border border-[#C7A43A]/45 bg-[linear-gradient(145deg,rgba(49,42,32,0.74),rgba(25,22,18,0.88))] px-4 py-4 text-sm leading-relaxed tracking-normal text-[#F7ECD8] shadow-[inset_0_1px_0_rgba(255,243,211,0.035),0_12px_30px_rgba(0,0,0,0.18)] outline-none transition placeholder:text-[#918373] focus:border-[#D8B84C] focus:ring-1 focus:ring-[#D8B84C]/45 disabled:opacity-65"
                  />
                  <p className="mt-1.5 text-right text-[0.68rem] tabular-nums text-[#887D70]">
                    {memoryDetail.length}/200
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {memoryCopy.suggestions.map((suggestion) => (
                    <span key={suggestion} className="rounded-full border border-[#B9944D]/25 bg-[#D8B84C]/[0.045] px-3 py-1.5 text-[0.68rem] leading-snug tracking-normal text-[#A99C8B]">
                      {suggestion}
                    </span>
                  ))}
                </div>

                {generationError ? (
                  <p role="alert" className="mt-4 rounded-xl border border-[#B9665A]/35 bg-[#B9665A]/10 px-4 py-3 text-sm leading-relaxed text-[#E6A59A]">
                    {generationError}
                  </p>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setStep(2)}
                    className="inline-flex items-center justify-center rounded-full border border-[#C7A43A]/55 bg-transparent px-5 py-3 text-sm font-medium text-[#D8B84C] transition hover:bg-[#D8B84C]/10 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {previewCopy.back}
                  </button>
                  <button
                    type="button"
                    disabled={!memoryDetail.trim() || (isCustomScene && !customSceneDescription.trim()) || isGenerating}
                    onClick={generateVisualMemory}
                    className="inline-flex items-center justify-center rounded-full border border-[#D8B84C]/80 bg-[#D8B84C] px-4 py-3 text-center text-sm font-medium text-[#17130B] shadow-[0_8px_22px_rgba(216,184,76,0.16)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isGenerating
                      ? previewCopy.generating
                      : generationError
                        ? previewCopy.retry
                        : previewCopy.generate}
                  </button>
                </div>
              </>
            ) : (
              <div className="relative -mx-5 mt-4 isolate overflow-hidden px-5 pb-2 pt-3 sm:-mx-7 sm:px-7 lg:-mx-9 lg:px-9">
                <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
                  <Image
                    src="/images/Golden Floral Haze Background.png"
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 1024px"
                    className="object-cover opacity-[0.13] mix-blend-screen"
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_52%,rgba(216,184,76,0.15),transparent_34%),radial-gradient(circle_at_82%_20%,rgba(216,184,76,0.07),transparent_24%),linear-gradient(100deg,rgba(5,5,4,0.2),rgba(5,5,4,0.84))]" />
                  <div className="absolute left-[8%] top-[16%] size-1 rounded-full bg-[#F1D982]/30 blur-[0.5px]" />
                  <div className="absolute right-[12%] top-[38%] size-1.5 rounded-full bg-[#F1D982]/20 blur-[1px]" />
                  <div className="absolute bottom-[18%] right-[36%] size-1 rounded-full bg-[#F1D982]/25 blur-[0.5px]" />
                </div>

                <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1.12fr)_minmax(260px,0.88fr)] md:gap-10 lg:gap-14">
                  <div className="order-1 text-center md:col-start-2 md:row-start-1 md:self-end md:text-left">
                    <p className="text-[0.65rem] font-medium tracking-[0.2em] text-[#D8B84C]">VISUAL MEMORY</p>
                    <h2 id="visual-memory-preview-title" className="mt-3 text-2xl font-medium leading-tight text-[#F3E8D2] sm:text-3xl lg:text-[2.15rem]">
                      {previewCopy.resultTitle}
                    </h2>
                    <p className="mt-3 text-sm font-light leading-relaxed text-[#C4B8A8] sm:text-base">
                      {previewCopy.resultIntro}
                    </p>
                  </div>

                  {generatedImageUrl ? (
                    <div className="order-2 relative mx-auto w-[min(88vw,360px)] md:col-start-1 md:row-span-2 md:row-start-1 md:w-full md:max-w-[460px]">
                      <div className="absolute inset-[8%] -z-10 rounded-full bg-[#D8B84C]/20 blur-3xl" aria-hidden="true" />
                      <figure ref={polaroidRef} className={`${koreanLetterFont.variable} relative isolate w-full overflow-hidden rounded-[11px] border border-[#FFF8E8]/75 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,0.82),transparent_28%),repeating-linear-gradient(17deg,rgba(116,88,48,0.022)_0,rgba(116,88,48,0.022)_1px,transparent_1px,transparent_5px),repeating-linear-gradient(103deg,rgba(255,255,255,0.035)_0,rgba(255,255,255,0.035)_1px,transparent_1px,transparent_7px),linear-gradient(145deg,#FFF9EC,#EADCC4)] p-[15px] pb-[24px] shadow-[0_32px_78px_rgba(0,0,0,0.6),0_5px_16px_rgba(31,23,13,0.22),inset_0_0_26px_rgba(119,88,48,0.08)]`}>
                        <span className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-[radial-gradient(circle_at_28%_34%,rgba(112,82,45,0.028)_0_0.7px,transparent_0.9px),radial-gradient(circle_at_72%_68%,rgba(255,255,255,0.18)_0_0.6px,transparent_0.85px)] bg-[size:11px_13px,13px_15px] opacity-70 shadow-[inset_0_0_18px_rgba(91,64,34,0.12)]" aria-hidden="true" />
                        <span className="pointer-events-none absolute right-6 top-1.5 z-20 h-2 w-11 rotate-[1.5deg] rounded-[1px] bg-[#E8D8B8]/25 shadow-[0_1px_2px_rgba(85,62,33,0.08)]" aria-hidden="true" />
                        <div className="relative z-10 aspect-square w-full overflow-hidden rounded-[5px] bg-[#171511] shadow-[0_1px_3px_rgba(55,38,18,0.22),inset_0_0_0_1px_rgba(65,49,27,0.16)]">
                          <Image
                            src={generatedImageUrl}
                            alt=""
                            fill
                            unoptimized
                            sizes="(max-width: 767px) min(88vw, 360px), 430px"
                            className="object-cover"
                          />
                        </div>
                        <figcaption className="relative z-10 flex min-h-[104px] flex-col items-center px-3 pb-0 pt-4 text-center text-[#292219] md:min-h-[122px] md:px-5 md:pt-[18px]">
                          <p className="max-w-[90%] text-[1.38rem] font-medium leading-[1.15] tracking-[-0.012em] text-[#34291F] md:text-[1.62rem]" style={{ fontFamily: language === "ko" ? "var(--font-nanum-myeongjo), serif" : "var(--font-playfair), Georgia, serif" }}>{generatedTitle}</p>
                          <div className="mt-2 flex w-[58%] items-center gap-2 text-[#B28A43]/65" aria-hidden="true">
                            <span className="h-px flex-1 bg-current" />
                            <span className="relative block h-2.5 w-3">
                              <span className="absolute bottom-0 left-1/2 h-[5px] w-[7px] -translate-x-1/2 rounded-[55%_55%_48%_48%] bg-current" />
                              <span className="absolute left-0.5 top-0 size-[3px] rounded-full bg-current" />
                              <span className="absolute left-[4.5px] top-[-1px] size-[3px] rounded-full bg-current" />
                              <span className="absolute right-0.5 top-0 size-[3px] rounded-full bg-current" />
                            </span>
                            <span className="h-px flex-1 bg-current" />
                          </div>
                          <p className="mt-1.5 max-w-[84%] text-[0.95rem] font-medium italic leading-[1.45] tracking-normal text-[#5D4D3D] md:text-[1.02rem]" style={{ fontFamily: language === "ko" ? "var(--font-letter-ko), var(--font-nanum-myeongjo), serif" : "var(--font-cormorant), Georgia, serif" }}>{generatedCaption}</p>
                          <div className="mt-auto w-full pt-2 text-[0.52rem] font-medium tracking-[0.16em] text-[#8B7658]/85">
                            {previewCopy.soulTraceMark}
                          </div>
                        </figcaption>
                        <span className="pointer-events-none absolute bottom-2.5 right-2.5 z-20 block h-7 w-8 rotate-[-8deg] opacity-[0.22]" aria-hidden="true">
                          <span className="absolute bottom-0 left-3 h-7 w-px rotate-[18deg] bg-[#8E835F]" />
                          <span className="absolute bottom-2 left-1 h-[7px] w-3 -rotate-[20deg] rounded-[80%_15%_80%_15%] border border-[#8E835F]" />
                          <span className="absolute bottom-4 left-3 h-[7px] w-3 rotate-[18deg] rounded-[15%_80%_15%_80%] border border-[#8E835F]" />
                          <span className="absolute bottom-0 left-[14px] size-1 rounded-full bg-[#B28A43]" />
                        </span>
                      </figure>
                    </div>
                  ) : null}

                  <div className="order-3 md:col-start-2 md:row-start-2 md:self-start">
                    {generationError ? (
                      <p role="alert" className="mb-4 rounded-xl border border-[#B9665A]/35 bg-[#B9665A]/10 px-4 py-3 text-sm leading-relaxed text-[#E6A59A]">
                        {generationError}
                      </p>
                    ) : null}
                    {downloadError ? (
                      <p role="alert" className="mb-4 rounded-xl border border-[#B9665A]/35 bg-[#B9665A]/10 px-4 py-3 text-sm leading-relaxed text-[#E6A59A]">
                        {downloadError}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!generatedImageUrl || isDownloading}
                      onClick={downloadVisualMemory}
                      className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#D8B84C] bg-[#D8B84C] px-5 py-3 text-sm font-medium text-[#17130B] shadow-[0_10px_28px_rgba(216,184,76,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isDownloading ? previewCopy.preparingDownload : previewCopy.download}
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={generateVisualMemory}
                      className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-[#C7A43A]/60 bg-black/20 px-5 py-3 text-sm font-medium text-[#E7D8BC] transition hover:border-[#D8B84C] hover:bg-[#D8B84C]/10 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {isGenerating
                        ? previewCopy.regenerating
                        : generationError
                          ? previewCopy.retry
                          : previewCopy.generateAgain}
                    </button>
                    <button
                      type="button"
                      disabled={isGenerating}
                      onClick={() => setStep(2)}
                      className="mx-auto mt-4 block text-sm text-[#B8A98F] underline decoration-[#C7A43A]/35 underline-offset-4 transition hover:text-[#D8B84C] disabled:cursor-not-allowed disabled:opacity-55 md:mx-0"
                    >
                      {previewCopy.chooseDifferentScene}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
