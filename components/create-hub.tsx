"use client";

import { useLocale } from "@/components/locale-provider";
import { LanguageToggle } from "@/components/language-toggle";
import { storyTabProps } from "@/lib/story-tabs";
import { BrandMark } from "@/components/storybook/brand-mark";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { letterPathForLifeStatus, type LifeStatus } from "@/lib/pet-first-archive";
import { polaroidHrefFromArchive } from "@/lib/memory-library";
import { petFirstCopy } from "@/lib/storybook-copy";
import { POSE_ART } from "@/lib/pose-art";
import Link from "next/link";

export function CreateHub({
  petId,
  petName,
  lifeStatus,
  signedIn,
}: {
  petId: string | null;
  petName?: string | null;
  lifeStatus: LifeStatus;
  signedIn: boolean;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const letterHref = petId
    ? letterPathForLifeStatus(lifeStatus, petId)
    : lifeStatus === "living"
      ? "/living"
      : lifeStatus === "memorial"
        ? "/memorial"
        : "/choose";
  const polaroidHref = petId ? polaroidHrefFromArchive(petId) : "/polaroid";

  return (
    <div className={`flex h-[100svh] flex-col overflow-hidden bg-[#f6ebe3] text-[#1e4d3a] ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="relative mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col">
        <div className="absolute inset-x-0 top-0 z-[2] flex items-start justify-between px-4 pt-[max(0.7rem,env(safe-area-inset-top))]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6ebe3]/92 px-3 py-1.5 text-[#1e4d3a]">
            <BrandMark className="h-5 w-5" />
            <span className="font-display-en text-sm tracking-[0.04em]">SoulTrace</span>
          </span>
          <LanguageToggle tone="paper" compact />
        </div>

        <div className="shrink-0 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+3.25rem)]">
          <h1 className="st-headline text-balance text-center text-[clamp(1.25rem,5.4vw,1.5rem)] leading-[1.3] !tracking-[-0.03em] text-[#163e2e]">{copy.createTitle}</h1>
          <p className="mx-auto mt-2 max-w-[22rem] text-center text-[13px] leading-5 text-[#3e6274]">{copy.createBody}</p>
          {petName ? <p className="mx-auto mt-2 max-w-[22rem] truncate text-center text-sm font-semibold text-[#1e4d3a]">{petName}</p> : null}
        </div>

        <div className="mt-1 grid min-h-0 flex-1 grid-rows-2 gap-0 px-0 pb-0">
          <CreateCard href={letterHref} src={POSE_ART.shibaHome} title={copy.createLetterTitle} body={copy.createLetterBody} />
          <CreateCard href={polaroidHref} src={POSE_ART.corgiSpring} title={copy.createPolaroidTitle} body={copy.createPolaroidBody} />
        </div>
      </main>
      <StoryTabbar current="create" {...storyTabProps(copy, petId, signedIn, lifeStatus)} />
    </div>
  );
}

function CreateCard({
  href,
  src,
  title,
  body,
}: {
  href: string;
  src: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="relative min-h-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="absolute inset-0 h-full w-full scale-[1.12] object-cover object-[center_40%]" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#10281f]/75 via-[#10281f]/35 to-transparent px-4 pb-4 pt-10">
        <strong className="block text-[1.05rem] font-semibold text-[#f6ebe3]">{title}</strong>
        <span className="mt-1 block text-sm leading-5 text-[#ead6c4]">{body}</span>
      </span>
    </Link>
  );
}
