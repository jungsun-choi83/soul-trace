"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryScene } from "@/components/storybook/story-scene";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { type LifeStatus } from "@/lib/pet-first-archive";
import { petFirstCopy } from "@/lib/storybook-copy";
import { POSE_ART } from "@/lib/pose-art";
import type { ReactNode } from "react";

export function StorybookShell({
  backHref,
  titleKey,
  petId = null,
  lifeStatus = null,
  children,
}: {
  backHref: string;
  titleKey: "createPet" | "editPet";
  petId?: string | null;
  lifeStatus?: LifeStatus | null;
  children: ReactNode;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const creating = titleKey === "createPet";
  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5">
        <StoryBrandHeader backHref={backHref} />
        {creating ? (
          <>
            <UiuxHero src={POSE_ART.shibaSpring} title={copy.setupTitle} body={copy.setupBody} />
            <p className="st-eyebrow mt-6">{copy.helloLittle}</p>
            <StoryScene scene="portrait" className="mt-5 rounded-[15px]" />
          </>
        ) : (
          <h1 className="st-headline mt-6 text-3xl">{copy.editPet}</h1>
        )}
        <div className="st-card mt-6 px-5 py-6">{children}</div>
      </main>
      <StoryTabbar current="pet" {...storyTabProps(copy, petId, true, lifeStatus)} />
    </div>
  );
}
