"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { authEntryPath } from "@/lib/auth-redirect";
import {
  entryHomePath,
  petsOnBranch,
  petsOnOtherBranch,
} from "@/lib/entry-branch";
import { polaroidHrefFromArchive } from "@/lib/memory-library";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께하는 오늘",
    today: "오늘의 추억 등록",
    todayBody: "사진이나 영상으로 오늘을 남겨요.",
    monthly: "월별 자동 사진 정리",
    monthlyBody: "이 아이의 사진을 달마다 모아요.",
    monthlyEmpty: "이번 달로 모을 사진이 아직 없어요.",
    letter: "AI 편지",
    letterBody: "지금 함께 있는 아이의 편지를 만들어요.",
    polaroid: "폴라로이드",
    polaroidBody: "오늘 장면을 폴라로이드로 남겨요.",
    collar: "스마트 목걸이",
    collarBody: "기기 연결 전. 블루투스 연동 전까지는 데모 화면이에요.",
    walk: "산책·활동 기록",
    walkBody: "목걸이와 휴대폰이 연결된 뒤에 기록이 남아요. 걸음 수는 연결 후에 표시돼요.",
    profile: "내 아이 프로필",
    profileBody: "저장할 때 함께 있는 아이인지 다시 확인해요.",
    beam: "Eternal Beam 장면 만들기",
    beamBody: "추억에 올린 사진으로 장면을 만들어요.",
    other: "구름 위에 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "이 아이 보기",
  },
  en: {
    title: "Today with our pet",
    today: "Save today's memory",
    todayBody: "Keep today with a photo or a video.",
    monthly: "Monthly photo folders",
    monthlyBody: "Photos of this pet are grouped by month.",
    monthlyEmpty: "No photos to group this month yet.",
    letter: "AI letter",
    letterBody: "Write a letter for the pet who's here.",
    polaroid: "Polaroid",
    polaroidBody: "Turn today's scene into a polaroid.",
    collar: "Smart collar",
    collarBody: "Not connected. This stays a demo until Bluetooth pairing exists.",
    walk: "Walks and activity",
    walkBody: "Records start after the collar and phone are connected. Step counts appear after that.",
    profile: "Pet profile",
    profileBody: "The profile save asks you to confirm this pet is here with you.",
    beam: "Make an Eternal Beam scene",
    beamBody: "Build the scene from a photo in Memories.",
    other: "Pets above the clouds",
    confirm: "Pets waiting for a status",
    pick: "View this pet",
  },
} as const;

export function LivingHome({
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
  const here = petsOnBranch(pets, "living", selectedPetId);
  const elsewhere = petsOnOtherBranch(pets, "living");
  const waiting = pets.filter((pet) => pet.lifeStatus === "unspecified" && pet.petId !== selectedPetId);
  const selected = here.find((pet) => pet.petId === selectedPetId) ?? here.find((pet) => pet.lifeStatus === "living") ?? null;
  const petId = selected?.petId ?? null;
  const visibleIds = new Set(here.map((pet) => pet.petId));
  const memories = recent.filter((item) => visibleIds.has(item.petId));
  const months = groupMonths(memories);
  const saveHref = (path: string) => (signedIn ? path : authEntryPath(path));
  const todayHref = !signedIn
    ? authEntryPath("/my/pets/new?status=living")
    : petId
      ? `/my/pets/${petId}#compose`
      : "/my/pets/new?status=living";
  const monthlyHref = petId ? saveHref(`/my/pets/${petId}#monthly`) : saveHref("/my/pets/new?status=living");
  const letterHref = petId ? `/living?petId=${encodeURIComponent(petId)}` : "/living";
  const polaroidHref = petId ? polaroidHrefFromArchive(petId) : "/polaroid";
  const collarHref = petId ? `/my/device?pet=${encodeURIComponent(petId)}` : "/my/device";
  const profileHref = petId ? saveHref(`/my/pets/${petId}/edit`) : saveHref("/my/pets");
  const beamHref = petId ? saveHref(`/my/pets/${petId}`) : "/life-archive";

  return (
    <div data-testid="living-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("living", petId)} settingsHref={signedIn ? "/settings" : authEntryPath("/dashboard/living")} settingsLabel={tabs.settingsTitle} />
        <section className="relative mt-4 overflow-hidden rounded-[22px] bg-[#f8f2e5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={UIUX_GARDEN_HERO} alt="" className="aspect-[941/1036] w-full object-contain object-center" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#24321f]/80 to-transparent px-4 pb-4 pt-14">
            <h1 className="st-headline text-[1.55rem] leading-snug text-[#fff8ea]">{copy.title}</h1>
          </div>
        </section>

        <PetSwitch
          here={here}
          elsewhere={elsewhere}
          waiting={waiting}
          selectedId={petId}
          branch="living"
          otherLabel={copy.other}
          confirmLabel={copy.confirm}
          pickLabel={copy.pick}
        />

        <div className="mt-4 grid gap-3">
          <Feature href={todayHref} title={copy.today} body={copy.todayBody} />
          <Feature href={monthlyHref} title={copy.monthly} body={copy.monthlyBody} />
          <Feature href={letterHref} title={copy.letter} body={copy.letterBody} />
          <Feature href={polaroidHref} title={copy.polaroid} body={copy.polaroidBody} />
          <Feature href={collarHref} title={copy.collar} body={copy.collarBody} />
          <Link href="/walks" className="block rounded-[22px] border border-[#e4d2b4] bg-[#fffaf1] px-4 py-4">
            <span className="block font-semibold text-[#3a452f]">{copy.walk}</span>
            <span className="mt-1 block text-sm leading-6 text-[#6b5846]">{copy.walkBody}</span>
          </Link>
          <Feature href={profileHref} title={copy.profile} body={copy.profileBody} />
        </div>

        <section className="mt-6" aria-labelledby="living-months">
          <h2 id="living-months" className="st-headline text-xl text-[#3a452f]">{copy.monthly}</h2>
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

        <section className="mt-6" aria-labelledby="living-beam">
          <h2 id="living-beam" className="st-headline text-xl text-[#3a452f]">{tabs.tabs.memories}</h2>
          <Feature href={beamHref} title={copy.beam} body={copy.beamBody} />
          <ul className="mt-3 grid gap-2">
            {memories.map((item) => (
              <li key={item.entryId}>
                <Link href={petId ? `/my/pets/${item.petId}` : beamHref} className="block rounded-[18px] border border-[#e4d2b4] bg-[#fffdf8] px-4 py-3 text-sm text-[#3a3428]">
                  {item.title || item.happenedOn || item.petName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <StoryTabbar current="home" {...storyTabProps(tabs, petId, signedIn, "living")} />
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

function PetSwitch({
  here,
  elsewhere,
  waiting,
  selectedId,
  branch,
  otherLabel,
  confirmLabel,
  pickLabel,
}: {
  here: HomePet[];
  elsewhere: HomePet[];
  waiting: HomePet[];
  selectedId: string | null;
  branch: "living" | "memorial";
  otherLabel: string;
  confirmLabel: string;
  pickLabel: string;
}) {
  if (here.length + elsewhere.length + waiting.length === 0) return null;
  return (
    <div className="mt-4 grid gap-3">
      {here.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {here.map((pet) => (
            <li key={pet.petId}>
              <Link
                href={entryHomePath(branch, pet.petId)}
                aria-current={pet.petId === selectedId ? "true" : undefined}
                className="inline-flex min-h-11 items-center rounded-full border border-[#c9d7b8] bg-[#f3f7ea] px-4 text-sm font-semibold text-[#2f3a28]"
              >
                {pet.petName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {elsewhere.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-[#6b5846]">{otherLabel}</p>
          <ul className="mt-2 flex gap-2 overflow-x-auto">
            {elsewhere.map((pet) => (
              <li key={pet.petId}>
                <Link href={entryHomePath(branch === "living" ? "memorial" : "living", pet.petId)} className="inline-flex min-h-11 items-center rounded-full border border-[#e4d2b4] px-4 text-sm text-[#3a3428]">
                  {pet.petName}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {waiting.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-[#6b5846]">{confirmLabel}</p>
          <ul className="mt-2 grid gap-2">
            {waiting.map((pet) => (
              <li key={pet.petId}>
                <Link href={entryHomePath(branch, pet.petId)} className="text-sm font-semibold text-[#5a3d27]">
                  {pet.petName} · {pickLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
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
