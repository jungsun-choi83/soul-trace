"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar, type StoryTab } from "@/components/storybook/story-tabbar";
import { petFirstCopy } from "@/lib/pet-first-archive";
import type { ReactNode } from "react";

export function PaperShell({
  title,
  backHref,
  current,
  children,
  brand = false,
  onBack,
  showTabs = true,
}: {
  title?: string;
  backHref?: string;
  current: StoryTab;
  children: ReactNode;
  brand?: boolean;
  onBack?: () => void;
  showTabs?: boolean;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  void brand;
  void title;

  return (
    <div className="st-paper st-grain flex min-h-[100svh] flex-col overflow-x-clip text-[#393129]">
      <div className="relative z-10 px-5 pt-[max(0.35rem,env(safe-area-inset-top))]">
        <StoryBrandHeader backHref={backHref} onBack={onBack} homeHref="/" />
      </div>
      {children}
      {showTabs ? <StoryTabbar current={current} {...storyTabProps(copy, null)} /> : null}
    </div>
  );
}
