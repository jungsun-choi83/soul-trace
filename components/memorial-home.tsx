"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { authEntryPath } from "@/lib/auth-redirect";
import { POSE_ART } from "@/lib/pose-art";
import {
  entryHomePath,
  petsOnBranch,
  petsOnOtherBranch,
} from "@/lib/entry-branch";
import { memorialSpaceHref } from "@/lib/memory-library";
import { HomeRecentMemories } from "@/components/home-recent-memories";
import { recentMemoriesForPet } from "@/lib/home-memory-preview";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께했던 소중한 순간들",
    importTitle: "우리 아이 사진 가져오기",
    importBody: "사진 원본은 그대로 두고, 이 아이 기록으로 모아요.",
    albumTitle: "월별 추억 앨범",
    albumBody: "함께한 추억을 연도와 월별 폴더로 모아 봐요.",
    recentTitle: "최근 함께한 추억",
    recentEmpty: "아직 남긴 추억이 없어요.",
    viewAll: "앨범 모두 보기",
    createTitle: "특별한 추억 만들기",
    createBody: "AI 편지와 폴라로이드는 만들기에서 이어져요.",
    hallEnter: "추모관 들어가기",
    hallBody: "보고 싶을 때만 들어가요. 기본 비공개예요.",
    other: "지금 함께 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "프로필에서 확인",
  },
  en: {
    title: "The moments we shared",
    importTitle: "Bring in our pet's photos",
    importBody: "Original photos stay as they are, and copies gather with this pet.",
    albumTitle: "Memories Album",
    albumBody: "Open this pet's memories, organized into year and month folders.",
    recentTitle: "Recent memories together",
    recentEmpty: "No memories for this pet yet.",
    viewAll: "View album",
    createTitle: "Make a special memory",
    createBody: "AI letters and polaroids continue from Create.",
    hallEnter: "Open the memorial space",
    hallBody: "Open it only when you want to. It stays private.",
    other: "Pets who are here now",
    confirm: "Pets waiting for a status",
    pick: "Confirm on the profile",
  },
} as const;

export function MemorialHome({
  signedIn,
  pets,
  recent,
  selectedPetId = null,
}: {
  signedIn: boolean;
  pets: HomePet[];
  recent: HomeRecent[];
  selectedPetId?: string | null;
}) {
  const { lang } = useLocale();
  const copy = COPY[lang === "en" ? "en" : "ko"];
  const tabs = petFirstCopy(lang);
  const here = petsOnBranch(pets, "memorial", selectedPetId);
  const elsewhere = petsOnOtherBranch(pets, "memorial");
  const waiting = pets.filter((pet) => pet.lifeStatus === "unspecified" && pet.petId !== selectedPetId);
  const selected = here.find((pet) => pet.petId === selectedPetId) ?? here.find((pet) => pet.lifeStatus === "memorial") ?? null;
  const petId = selected?.petId ?? null;
  const memories = recentMemoriesForPet(recent, petId);
  const saveHref = (path: string) => (signedIn ? path : authEntryPath(path));
  const importHref = petId ? saveHref(`/my/pets/${encodeURIComponent(petId)}/memories/record`) : saveHref("/my/pets/new?status=memorial");
  const albumHref = petId ? saveHref(`/my/pets/${encodeURIComponent(petId)}/memories#album`) : saveHref("/my/pets");
  const createHref = petId ? `/create?pet=${encodeURIComponent(petId)}&branch=memorial` : "/create?branch=memorial";
  const hallHref = petId ? saveHref(memorialSpaceHref(petId)) : saveHref("/memorial-space");

  return (
    <div data-testid="memorial-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("memorial", petId)} settingsHref={signedIn ? "/settings" : authEntryPath("/dashboard/memorial")} settingsLabel={tabs.settingsTitle} />
        <section className="mt-4 overflow-hidden rounded-[22px] bg-[#efe6d6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={POSE_ART.shibaAutumn} alt="" className="aspect-[4/3] w-full bg-[#efe6d6] object-contain object-center" />
          <h1 className="st-headline px-4 py-3 text-[clamp(1.2rem,5vw,1.5rem)] leading-snug !tracking-[-0.03em] text-[#3a3428]">{copy.title}</h1>
        </section>

        {here.length > 0 ? (
          <ul className="mt-4 flex gap-2 overflow-x-auto">
            {here.map((pet) => (
              <li key={pet.petId}>
                <Link href={entryHomePath("memorial", pet.petId)} aria-current={pet.petId === petId ? "true" : undefined} className="inline-flex min-h-11 items-center rounded-full border border-[#d5dbe3] bg-[#f4f6f8] px-4 text-sm font-semibold text-[#2c3642]">
                  {pet.petName}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {elsewhere.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[#6b5846]">{copy.other}</p>
            <ul className="mt-2 flex gap-2 overflow-x-auto">
              {elsewhere.map((pet) => (
                <li key={pet.petId}>
                  <Link href={entryHomePath("living", pet.petId)} className="inline-flex min-h-11 items-center rounded-full border border-[#e4d2b4] px-4 text-sm text-[#3a3428]">
                    {pet.petName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {waiting.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold text-[#6b5846]">{copy.confirm}</p>
            <ul className="mt-2 grid gap-2">
              {waiting.map((pet) => (
                <li key={pet.petId}>
                  <Link href={entryHomePath("memorial", pet.petId)} className="text-sm font-semibold text-[#5a3d27]">{pet.petName} · {copy.pick}</Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          <Feature href={importHref} title={copy.importTitle} body={copy.importBody} />
          <Feature href={albumHref} title={copy.albumTitle} body={copy.albumBody} />
          <Feature href={createHref} title={copy.createTitle} body={copy.createBody} />
        </div>
        <Link href={hallHref} className="mt-3 block rounded-[18px] px-1 py-2">
          <span className="block text-sm font-semibold text-[#5a3d27]">{copy.hallEnter}</span>
          <span className="mt-1 block text-sm leading-6 text-[#6b5846]">{copy.hallBody}</span>
        </Link>

        <HomeRecentMemories
          items={memories}
          href={albumHref}
          lang={lang === "en" ? "en" : "ko"}
          title={copy.recentTitle}
          empty={copy.recentEmpty}
          viewAll={copy.viewAll}
        />

      </main>
      <StoryTabbar current="home" {...storyTabProps(tabs, petId, signedIn, "memorial")} />
    </div>
  );
}

function Feature({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="block rounded-[22px] border border-[#e4d2b4] bg-[#fffaf1] px-4 py-4">
      <span className="block font-semibold text-[#3a452f]">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-[#6b5846]">{body}</span>
    </Link>
  );
}
