"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { authEntryPath } from "@/lib/auth-redirect";
import { CLEAN_ART } from "@/lib/design-art";
import {
  entryHomePath,
  petsOnBranch,
  petsOnOtherBranch,
} from "@/lib/entry-branch";
import { memorialSpaceHref, moodJournalHref, polaroidHrefFromArchive } from "@/lib/memory-library";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께했던 소중한 순간들",
    photos: "함께했던 사진과 영상",
    photosBody: "이 아이와 남긴 사진과 영상을 모아 봐요.",
    monthly: "월별 추억 아카이브",
    monthlyBody: "함께했던 기록을 달마다 다시 볼 수 있어요.",
    monthlyEmpty: "이 홈에 모을 기록이 아직 없어요.",
    letter: "AI 편지",
    letterBody: "떠나보낸 아이의 편지를 만들어요.",
    polaroid: "폴라로이드",
    polaroidBody: "함께했던 장면을 폴라로이드로 남겨요.",
    hall: "추모관",
    hallBody: "기본 비공개. 보호자만 들어가요.",
    mood: "마음 기록",
    moodBody: "기본 비공개. 보호자만 적어요.",
    family: "가족 공유",
    familyBody: "권한을 확인한 뒤에 열려요. 지금은 초대가 연결되지 않았어요.",
    profile: "내 아이 프로필",
    profileBody: "저장할 때 구름 위에 있는 아이인지 다시 확인해요.",
    beam: "Eternal Beam 장면 만들기",
    beamBody: "추억에 올린 사진으로 장면을 만들어요.",
    other: "지금 함께 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "프로필에서 확인",
  },
  en: {
    title: "The moments we shared",
    photos: "Photos and videos together",
    photosBody: "The photos and videos you kept with this pet.",
    monthly: "Monthly memory archive",
    monthlyBody: "Look through what you shared, month by month.",
    monthlyEmpty: "Nothing is gathered on this home yet.",
    letter: "AI letter",
    letterBody: "Write a letter for the pet you said goodbye to.",
    polaroid: "Polaroid",
    polaroidBody: "Keep a shared scene as a polaroid.",
    hall: "Memorial space",
    hallBody: "Private by default. Only the guardian can open it.",
    mood: "Mood journal",
    moodBody: "Private by default. Only the guardian can write it.",
    family: "Family sharing",
    familyBody: "This opens after permission is checked. Invites are not connected yet.",
    profile: "Pet profile",
    profileBody: "The profile save asks you to confirm this pet is above the clouds.",
    beam: "Make an Eternal Beam scene",
    beamBody: "Build the scene from a photo in Memories.",
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
  const visibleIds = new Set(here.map((pet) => pet.petId));
  const memories = recent.filter((item) => visibleIds.has(item.petId));
  const months = groupMonths(memories);
  const saveHref = (path: string) => (signedIn ? path : authEntryPath(path));
  const photosHref = !signedIn
    ? authEntryPath("/my/pets/new?status=memorial")
    : petId
      ? `/my/pets/${petId}`
      : "/my/pets/new?status=memorial";
  const monthlyHref = petId ? saveHref(`/my/pets/${petId}#monthly`) : saveHref("/my/pets/new?status=memorial");
  const letterHref = petId ? `/memorial?petId=${encodeURIComponent(petId)}` : "/memorial";
  const polaroidHref = petId ? polaroidHrefFromArchive(petId) : "/polaroid";
  const hallHref = petId ? memorialSpaceHref(petId) : "/memorial-space";
  const moodHref = petId ? moodJournalHref(petId) : "/mood-journal";
  const profileHref = petId ? saveHref(`/my/pets/${petId}/edit`) : saveHref("/my/pets");
  const beamHref = petId ? saveHref(`/my/pets/${petId}`) : "/life-archive";

  return (
    <div data-testid="memorial-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("memorial", petId)} settingsHref={signedIn ? "/settings" : authEntryPath("/dashboard/memorial")} settingsLabel={tabs.settingsTitle} />
        <section className="relative mt-4 overflow-hidden rounded-[22px] bg-[#efe6d6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CLEAN_ART.nightWindow} alt="" className="aspect-[1086/1448] w-full object-contain object-center" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2a313c]/78 to-transparent px-4 pb-4 pt-14">
            <h1 className="st-headline text-[1.55rem] leading-snug text-[#fff8ea]">{copy.title}</h1>
          </div>
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
          <Feature href={photosHref} title={copy.photos} body={copy.photosBody} />
          <Feature href={monthlyHref} title={copy.monthly} body={copy.monthlyBody} />
          <Feature href={letterHref} title={copy.letter} body={copy.letterBody} />
          <Feature href={polaroidHref} title={copy.polaroid} body={copy.polaroidBody} />
          <Feature href={hallHref} title={copy.hall} body={copy.hallBody} />
          <Feature href={moodHref} title={copy.mood} body={copy.moodBody} />
          <Link href="/family" className="block rounded-[22px] border border-[#e4d2b4] bg-[#fffaf1] px-4 py-4">
            <span className="block font-semibold text-[#3a452f]">{copy.family}</span>
            <span className="mt-1 block text-sm leading-6 text-[#6b5846]">{copy.familyBody}</span>
          </Link>
          <Feature href={profileHref} title={copy.profile} body={copy.profileBody} />
        </div>

        <section className="mt-6" aria-labelledby="memorial-months">
          <h2 id="memorial-months" className="st-headline text-xl text-[#3a452f]">{copy.monthly}</h2>
          {months.length === 0 ? <p className="mt-2 text-sm text-[#6b5846]">{copy.monthlyEmpty}</p> : null}
          <ul className="mt-3 grid gap-2">
            {months.map(([month, items]) => (
              <li key={month}>
                <Link href={monthlyHref} className="block rounded-[18px] border border-[#e4d2b4] bg-[#fffdf8] px-4 py-3">
                  <span className="font-semibold text-[#3a452f]">{month}</span>
                  <span className="mt-1 block text-sm text-[#6b5846]">{items.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6" aria-labelledby="memorial-beam">
          <h2 id="memorial-beam" className="st-headline text-xl text-[#3a452f]">{tabs.tabs.memories}</h2>
          <Feature href={beamHref} title={copy.beam} body={copy.beamBody} />
        </section>
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

function groupMonths(items: HomeRecent[]): [string, HomeRecent[]][] {
  const groups = new Map<string, HomeRecent[]>();
  for (const item of items) {
    const key = (item.happenedOn ?? item.createdAt).slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()];
}
