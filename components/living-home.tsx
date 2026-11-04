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
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께하는 오늘",
    importTitle: "우리 아이 사진 가져오기",
    importBody: "사진 원본은 그대로 두고, 이 아이 기록으로 모아요.",
    monthTitle: "이번 달의 추억",
    monthBody: "촬영일 기준으로 이번 달 사진을 모아 봐요.",
    monthlyEmpty: "이번 달로 모을 사진이 아직 없어요.",
    createTitle: "특별한 추억 만들기",
    createBody: "AI 편지와 폴라로이드는 만들기에서 이어져요.",
    deviceStatus: "기기 연결 전 · 데모",
    other: "구름 위에 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "이 아이 보기",
  },
  en: {
    title: "Today with our pet",
    importTitle: "Bring in our pet's photos",
    importBody: "Original photos stay as they are, and copies gather with this pet.",
    monthTitle: "This month's memories",
    monthBody: "Photos from this month stay grouped by the day they were taken.",
    monthlyEmpty: "No photos to group this month yet.",
    createTitle: "Make a special memory",
    createBody: "AI letters and polaroids continue from Create.",
    deviceStatus: "Device not connected · demo",
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
  const importHref = petId ? saveHref(`/memories/import?pet=${encodeURIComponent(petId)}`) : saveHref("/my/pets/new?status=living");
  const monthlyHref = petId ? saveHref(`/memories/month?pet=${encodeURIComponent(petId)}`) : saveHref("/my/pets/new?status=living");
  const createHref = petId ? `/create?pet=${encodeURIComponent(petId)}&branch=living` : "/create?branch=living";
  const collarHref = petId ? `/my/device?pet=${encodeURIComponent(petId)}` : "/my/device";

  return (
    <div data-testid="living-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("living", petId)} settingsHref={signedIn ? "/settings" : authEntryPath("/dashboard/living")} settingsLabel={tabs.settingsTitle} />
        <section className="relative mt-4 overflow-hidden rounded-[22px] bg-[#f8f2e5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={UIUX_GARDEN_HERO} alt="" className="aspect-[4/3] w-full object-cover object-[center_42%]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#24321f]/80 to-transparent px-4 pb-4 pt-12">
            <h1 className="st-headline text-[clamp(1.25rem,5.4vw,1.55rem)] leading-snug !tracking-[-0.03em] text-[#fff8ea]">{copy.title}</h1>
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
          <Feature href={importHref} title={copy.importTitle} body={copy.importBody} />
          <Feature href={monthlyHref} title={copy.monthTitle} body={copy.monthBody} />
          <Feature href={createHref} title={copy.createTitle} body={copy.createBody} />
        </div>
        <Link href={collarHref} className="mt-3 inline-flex min-h-11 items-center text-sm text-[#6b5846]">
          {copy.deviceStatus}
        </Link>

        <section className="mt-6" aria-labelledby="living-months">
          <h2 id="living-months" className="st-headline text-xl text-[#3a452f]">{copy.monthTitle}</h2>
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

        <ul className="mt-3 grid gap-2">
          {memories.map((item) => (
            <li key={item.entryId}>
              <Link href={`/my/pets/${item.petId}`} className="block rounded-[18px] border border-[#e4d2b4] bg-[#fffdf8] px-4 py-3 text-sm text-[#3a3428]">
                {item.title || item.happenedOn || item.petName}
              </Link>
            </li>
          ))}
        </ul>
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
