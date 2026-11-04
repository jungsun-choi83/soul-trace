"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryState } from "@/components/storybook/story-state";
import { petFirstCopy } from "@/lib/pet-first-archive";
import Link from "next/link";

export function DeviceLivingOnly({ petName }: { petName: string }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  return (
    <div className={`st-paper st-grain st-body min-h-[100svh] ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto flex min-h-[100svh] max-w-xl items-center px-4 py-10">
        <StoryState
          kind="empty"
          scene="home"
          title={`${petName} · ${copy.deviceLivingOnly}`}
          action={<Link href="/dashboard" className="st-btn st-btn-quiet">{copy.tabs.home}</Link>}
        />
      </main>
    </div>
  );
}
