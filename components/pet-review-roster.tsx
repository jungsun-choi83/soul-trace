"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import type { HomePet } from "@/lib/pet-first-archive-data";
import { splitCurrentAndUnclassifiedPets } from "@/lib/pet-review";
import { storyTabProps } from "@/lib/story-tabs";
import { petFirstCopy } from "@/lib/storybook-copy";
import Link from "next/link";

export function PetReviewRoster({ pets }: { pets: HomePet[] }) {
  const { lang } = useLocale();
  const tabs = petFirstCopy(lang);
  const { unclassified } = splitCurrentAndUnclassifiedPets(pets);
  const copy = lang === "en"
    ? {
        title: "Review pet profiles",
        intro: "These profiles do not have a Living or Memorial status yet. Review each existing profile before choosing.",
        count: (n: number) => `${n} linked letter${n === 1 ? "" : "s"}`,
        none: "No linked letters",
        action: "Review profile and choose a status",
        preserve: "This updates the existing profile. Its Pet ID, letters, and memories stay linked.",
        letters: "Open linked letters",
        empty: "There are no profiles waiting for review.",
        id: "Pet ID ending",
      }
    : {
        title: "반려동물 프로필 확인",
        intro: "아직 Living 또는 Memorial 상태가 지정되지 않은 프로필입니다. 기존 프로필을 확인한 뒤 상태를 선택해 주세요.",
        count: (n: number) => `연결된 편지 ${n}개`,
        none: "연결된 편지가 없습니다",
        action: "프로필을 확인하고 상태 선택",
        preserve: "기존 프로필을 수정합니다. Pet ID와 편지, 추억 연결은 유지됩니다.",
        letters: "연결된 편지 보기",
        empty: "확인이 필요한 프로필이 없습니다.",
        id: "Pet ID 끝자리",
      };

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref="/my/pets" settingsHref="/settings" settingsLabel={tabs.settingsTitle} />
        <section className="st-card mt-6 px-5 py-6" aria-labelledby="pet-review-title">
          <h1 id="pet-review-title" className="st-headline text-2xl">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--st-text-soft)]">{copy.intro}</p>
        </section>
        {unclassified.length === 0 ? (
          <p className="st-card mt-5 px-5 py-5 text-sm text-[color:var(--st-text-soft)]">{copy.empty}</p>
        ) : (
          <ul className="mt-5 grid gap-3">
            {unclassified.map((pet) => (
              <li key={pet.petId} className="st-card px-4 py-4">
                <h2 className="font-semibold">{pet.petName}</h2>
                <p className="mt-1 text-xs text-[color:var(--st-text-soft)]">{copy.id} {pet.petId.slice(-8)}</p>
                <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{pet.letterCount ? copy.count(pet.letterCount) : copy.none}</p>
                <Link href={`/my/pets/${encodeURIComponent(pet.petId)}/edit?focus=status`} className="st-btn st-btn-primary mt-4 w-full">
                  {copy.action}
                </Link>
                <p className="mt-2 text-xs leading-5 text-[color:var(--st-text-soft)]">{copy.preserve}</p>
                {pet.letterCount > 0 ? (
                  <Link href={`/life-archive?pet=${encodeURIComponent(pet.petId)}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
                    {copy.letters}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
      <StoryTabbar current="pet" {...storyTabProps(tabs, null, true, "unspecified")} />
    </div>
  );
}
