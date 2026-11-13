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
  lifeStatus,
  signedIn,
}: {
  petId: string | null;
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
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 pb-8">
        <section className="bg-[#f8f2e5]">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={POSE_ART.shibaSpring} alt="" className="aspect-[4/5] w-full bg-[#f6efe2] object-contain object-center sm:aspect-[5/4]" />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-[max(0.7rem,env(safe-area-inset-top))]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7ea]/92 px-3 py-1.5 text-[#6b4a2c] shadow-[0_8px_18px_-12px_rgba(90,61,39,0.45)]">
                <BrandMark className="h-5 w-5" />
                <span className="font-display-en text-sm tracking-[0.04em]">SoulTrace</span>
              </span>
              <LanguageToggle tone="paper" />
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="rounded-[22px] border border-[#e4d2b4] bg-[#fffaf1] px-5 py-5 text-center">
              <h1 className="st-headline text-[1.7rem] leading-snug text-[#3a452f]">{copy.createTitle}</h1>
              <p className="mt-2 text-sm leading-6 text-[#6b5846]">{copy.createBody}</p>
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-3 px-4">
          <CreateCard
            href={letterHref}
            src={POSE_ART.shibaHome}
            title={copy.createLetterTitle}
            body={copy.createLetterBody}
          />
          <CreateCard
            href={polaroidHref}
            src={POSE_ART.corgiSpring}
            title={copy.createPolaroidTitle}
            body={copy.createPolaroidBody}
          />
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
    <Link
      href={href}
      className="flex min-h-[6.5rem] items-center gap-3 rounded-[22px] border border-[#e4d2b4] bg-[#fffaf1] p-3 shadow-[0_10px_22px_-16px_rgba(90,61,39,0.4)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="size-[4.6rem] shrink-0 rounded-[16px] bg-[#f6efe2] object-contain object-center" />
      <span className="min-w-0">
        <strong className="block text-[1.05rem] font-semibold text-[#3a452f]">{title}</strong>
        <span className="mt-1 block text-sm leading-5 text-[#6b5846]">{body}</span>
      </span>
    </Link>
  );
}
