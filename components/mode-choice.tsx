"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { letterModePath, type LetterMode } from "@/lib/letter-mode";
import { cleanArtSize } from "@/lib/design-art";
import { petFirstCopy } from "@/lib/pet-first-archive";
import { PARTNER_CODE_PARAM } from "@/lib/partner";
import { clearLetterExperienceSession } from "@/lib/letter-experience-session";
import { parseServiceChannel, serviceChannelMode } from "@/lib/service-channel";
import { UIUX_GARDEN_HERO, UIUX_ROOM_ART } from "@/lib/uiux-art";
import Image from "next/image";
import Link from "next/link";

export function ModeChoice({
  partnerCode,
  preservedQuery = "",
}: {
  partnerCode: string | null;
  preservedQuery?: string;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const destinationParams = new URLSearchParams(preservedQuery);

  if (partnerCode && !destinationParams.has(PARTNER_CODE_PARAM)) {
    destinationParams.set(PARTNER_CODE_PARAM, partnerCode);
  }

  const destinationQuery = destinationParams.toString();
  const querySuffix = destinationQuery ? `?${destinationQuery}` : "";
  const hrefFor = (mode: LetterMode) => `${letterModePath(mode)}${querySuffix}`;
  const polaroidHref = `/polaroid${querySuffix}`;
  const petId = destinationParams.get("petId");
  const memorySpaceHref = petId && /^[0-9a-f-]{36}$/i.test(petId) ? `/my/pets/${petId}` : "/my/pets";
  const startLetter = (mode: LetterMode) => {
    if (typeof window === "undefined") return;
    const channel = parseServiceChannel(destinationParams.get("ch"));
    const routedMode = channel ? serviceChannelMode(channel) : mode;
    try {
      clearLetterExperienceSession(window.sessionStorage, routedMode, channel);
    } catch {
      // Navigation remains valid when sessionStorage is unavailable.
    }
  };

  return (
    <main className="flex min-h-[100svh] flex-col overflow-x-hidden bg-[#fffaf0] text-[#393129]">
      <div className="px-5 pt-[max(0.35rem,env(safe-area-inset-top))]">
        <StoryBrandHeader backHref={`/${querySuffix}` || "/"} homeHref="/" />
      </div>

      <LetterArt src={UIUX_GARDEN_HERO} imageAlt="" priority />
      <section className="mx-auto w-full max-w-md px-[21px] pb-8 pt-4">
        <p className="text-[10px] font-bold tracking-[0.15em] text-[#ad8655]">{copy.letterLivingEyebrow}</p>
        <h1 className={`mt-2 whitespace-pre-line text-[21px] font-semibold leading-[1.55] tracking-[-0.065em] text-[#393129] ${bodyFont}`}>
          {copy.letterLivingTitle}
        </h1>
        <p className={`mt-2 text-[11px] leading-[1.9] text-[#857666] ${bodyFont}`}>{copy.letterLivingBody}</p>
        <div className="mt-4 rounded-[18px] border border-[#eadcc6] bg-[#fffbf3] px-4 py-3.5 shadow-[0_3px_16px_#7f5c3810]">
          <p className={`text-[13px] font-semibold text-[#393129] ${bodyFont}`}>{copy.letterLivingGuest}</p>
          <p className={`mt-1.5 text-[11px] leading-6 text-[#857666] ${bodyFont}`}>{copy.letterLivingGuestBody}</p>
        </div>
        <Link
          href={hrefFor("living")}
          onClick={() => startLetter("living")}
          className={`st-btn st-btn-forest mt-4 w-full ${bodyFont}`}
        >
          {copy.letterLivingCta}
        </Link>
        <Link
          href={polaroidHref}
          className={`mt-2.5 flex min-h-[46px] w-full items-center justify-center rounded-[13px] border border-[#b7a38b] bg-transparent text-[12px] font-bold text-[#393129] ${bodyFont}`}
        >
          {copy.letterLivingPolaroid}
        </Link>
      </section>

      <LetterArt src={UIUX_ROOM_ART} imageAlt="" />
      <section className="mx-auto w-full max-w-md px-[21px] pb-10 pt-4">
        <p className="text-[10px] font-bold tracking-[0.15em] text-[#ad8655]">{copy.letterMemorialEyebrow}</p>
        <h2 className={`mt-2 whitespace-pre-line text-[21px] font-semibold leading-[1.55] tracking-[-0.065em] text-[#393129] ${bodyFont}`}>
          {copy.letterMemorialTitle}
        </h2>
        <p className={`mt-2 text-[11px] leading-[1.9] text-[#857666] ${bodyFont}`}>{copy.letterMemorialBody}</p>
        <div className="mt-4 rounded-[18px] border border-[#eadcc6] bg-[#fffbf3] px-4 py-3.5 shadow-[0_3px_16px_#7f5c3810]">
          <p className={`text-[13px] font-semibold text-[#393129] ${bodyFont}`}>{copy.letterMemorialNote}</p>
          <p className={`mt-1.5 text-[11px] leading-6 text-[#857666] ${bodyFont}`}>{copy.letterMemorialNoteBody}</p>
        </div>
        <Link
          href={hrefFor("memorial")}
          onClick={() => startLetter("memorial")}
          className={`st-btn st-btn-forest mt-4 w-full ${bodyFont}`}
        >
          {copy.letterMemorialCta}
        </Link>
        <Link
          href={memorySpaceHref}
          className={`mt-2.5 flex min-h-[46px] w-full items-center justify-center rounded-[13px] border border-[#b7a38b] bg-transparent text-[12px] font-bold text-[#393129] ${bodyFont}`}
        >
          {copy.letterMemorialSpace}
        </Link>
      </section>

      <StoryTabbar current="create" {...storyTabProps(copy, null)} />
    </main>
  );
}

function LetterArt({
  src,
  imageAlt,
  priority = false,
}: {
  src: string;
  imageAlt: string;
  priority?: boolean;
}) {
  const size = cleanArtSize(src);
  return (
    <div className="mx-auto w-full max-w-md px-5 pt-1">
      <Image
        src={src}
        alt={imageAlt}
        width={size.width}
        height={size.height}
        priority={priority}
        quality={90}
        sizes="(max-width: 600px) 100vw, 480px"
        className="block h-auto w-full rounded-[15px] bg-[#f8f2e5] object-contain"
      />
    </div>
  );
}
