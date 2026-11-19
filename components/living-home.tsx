"use client";

import { CollarProvider, useCollar } from "@/components/collar/collar-provider";
import { FreePolaroidNotice } from "@/components/free-polaroid-notice";
import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import {
  entryHomePath,
  petsOnBranch,
  petsOnOtherBranch,
} from "@/lib/entry-branch";
import { memoriesMonthHref } from "@/lib/memory-library";
import { daysTogether, seoulToday } from "@/lib/pet-first-archive";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { POSE_ART } from "@/lib/pose-art";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께하는 오늘",
    ddayLabel: "생일부터",
    ddayEmpty: "생일을 등록하면 디데이가 시작돼요.",
    importTitle: "우리아이의 여정",
    importBody: "언제 어디서나",
    monthTitle: "우리아이의 추억",
    cover: "이번 달 대표",
    createTitle: "우리의 특별한 추억",
    createBody: "편지와 폴라로이드",
    deviceTitle: "우리아이의 목걸이",
    connect: "기기 연결",
    battery: "배터리",
    sync: "동기화",
    syncEmpty: "동기화 기록 없음",
    face: "화면 꾸미기",
    activity: "활동 기록",
    other: "구름 위에 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "이 아이 보기",
  },
  en: {
    title: "Today with our pet",
    ddayLabel: "Since birthday",
    ddayEmpty: "Add a birthday to start the count.",
    importTitle: "Our pet's journey",
    importBody: "Anytime, anywhere",
    monthTitle: "Our pet's memories",
    cover: "Month's best shot",
    createTitle: "Our special memories",
    createBody: "Letter and polaroid",
    deviceTitle: "Our pet's collar",
    connect: "Connect a device",
    battery: "Battery",
    sync: "Sync",
    syncEmpty: "No sync record",
    face: "Design the screen",
    activity: "Activity",
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
  const importHref = petId ? `/memories?pet=${encodeURIComponent(petId)}` : "/memories";
  const monthlyHref = memoriesMonthHref(petId);
  const createHref = petId ? `/create?pet=${encodeURIComponent(petId)}&branch=living` : "/create?branch=living";
  const today = seoulToday();
  const monthKey = today.slice(0, 7);
  const monthNumber = Number(monthKey.slice(5));
  const monthPhoto = monthCover(recent, petId, monthKey);
  const birthdayDays = signedIn ? daysTogether(selected?.birthday ?? null, today) : null;

  return (
    <div data-testid="living-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("living", petId)} settingsHref="/settings" settingsLabel={tabs.settingsTitle} />
        <section className="mt-4 overflow-hidden rounded-[22px] border border-[#ead6c4] bg-[#f6ebe3] px-4 pb-5 pt-4 shadow-[0_16px_32px_-18px_rgba(30,77,58,0.55)]">
          <h1 className="st-headline text-[clamp(1.25rem,5.4vw,1.55rem)] leading-snug !tracking-[-0.03em] text-[#1e4d3a]">{copy.title}</h1>
          <div className="mt-6 text-center">
            {birthdayDays !== null ? (
              <>
                <p className="text-sm font-medium text-[#1e4d3a]">{copy.ddayLabel}</p>
                <p className="mt-1 text-[clamp(3.4rem,16vw,4.6rem)] font-semibold leading-none tracking-[-0.06em] text-[#1e4d3a]">
                  D+{birthdayDays.toLocaleString(lang === "en" ? "en-US" : "ko-KR")}
                </p>
              </>
            ) : (
              <>
                <p className="text-[clamp(3.4rem,16vw,4.6rem)] font-semibold leading-none tracking-[-0.06em] text-[#1e4d3a]/35">D+</p>
                <p className="mt-3 text-sm leading-5 text-[#1e4d3a]">{copy.ddayEmpty}</p>
              </>
            )}
          </div>
          {signedIn && petId ? <div className="mt-4"><FreePolaroidNotice petId={petId} /></div> : null}
        </section>

        {selected ? <CurrentPet pet={selected} /> : null}
        {signedIn && pets.length === 0 ? <EmptyPets /> : null}

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

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={importHref} className="st-card-sway col-span-2 flex min-h-[112px] items-center justify-between gap-3 rounded-[20px] border border-[#ead6c4] bg-[#f6ebe3] px-4 py-3 text-[#1e4d3a] shadow-[0_14px_28px_-16px_rgba(30,77,58,0.55)]">
            <span className="min-w-0">
              <span className="block text-[1.05rem] font-semibold leading-snug">{copy.importTitle}</span>
              <span className="mt-1 block text-sm leading-5 text-[#1e4d3a]">{copy.importBody}</span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/design/photo-stack.jpg" alt="" className="h-[88px] w-[104px] shrink-0 rounded-[16px] border border-[#1e4d3a] bg-[#e7f0f4] object-contain shadow-[0_8px_16px_-12px_rgba(30,77,58,0.8)]" />
          </Link>

          <Link href={monthlyHref} className="st-card-sway relative block aspect-[169/280] overflow-hidden rounded-[20px] border-[3px] border-[#f6ebe3] bg-[#ead6c4] text-[#1e4d3a] shadow-[0_16px_28px_-14px_rgba(30,77,58,0.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={monthPhoto ?? seasonPose(monthNumber)} alt="" className={monthPhoto?.includes("seasonal-polaroid") ? "absolute inset-0 h-full w-full bg-[#ead6c4] object-contain object-center" : "absolute inset-0 h-full w-full object-cover object-[center_30%]"} />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f6ebe3] via-[#f6ebe3]/90 to-transparent px-3 pb-3 pt-12 text-right">
              <span className="block text-sm font-medium text-[#1e4d3a]">{copy.monthTitle}</span>
              <span className="mt-0.5 block text-[2rem] font-semibold leading-none tracking-[-0.04em] text-[#55603a]">{monthNumber}월</span>
              {monthPhoto ? <span className="mt-1 block text-xs text-[#1e4d3a]">{copy.cover}</span> : null}
            </span>
          </Link>

          <Link href={createHref} className="st-card-sway flex min-h-[176px] flex-col rounded-[20px] bg-[#55603a] p-3 text-[#f6ebe3] shadow-[0_16px_28px_-12px_rgba(30,77,58,0.7)] ring-1 ring-[#1e4d3a]">
            <span>
              <span className="block text-[1.02rem] font-semibold leading-snug">{copy.createTitle}</span>
              <span className="mt-0.5 block text-sm leading-5 text-[#e7f0f4]">{copy.createBody}</span>
            </span>
            <span className="mt-3 flex min-h-0 flex-1 items-stretch justify-center">
              <span className="flex w-full flex-col bg-[#f6ebe3] p-1.5 pb-4 shadow-[0_10px_18px_-14px_rgba(20,24,18,0.8)]">
                <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#e7f0f4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/polaroid/style-gouache.jpg" alt="" className="max-h-full max-w-full object-contain" />
                </span>
              </span>
            </span>
          </Link>

          <CollarProvider pet={petId ? { petId, petName: selected?.petName ?? "우리 아이" } : null}>
            <DeviceCard
              title={copy.deviceTitle}
              connect={copy.connect}
              batteryLabel={copy.battery}
              syncLabel={copy.sync}
              syncEmpty={copy.syncEmpty}
              faceLabel={copy.face}
              activityLabel={copy.activity}
            />
          </CollarProvider>
        </div>
      </main>
      <StoryTabbar current="home" {...storyTabProps(tabs, petId, signedIn, "living")} />
    </div>
  );
}

function DeviceCard({
  title,
  connect,
  batteryLabel,
  syncLabel,
  syncEmpty,
  faceLabel,
  activityLabel,
}: {
  title: string;
  connect: string;
  batteryLabel: string;
  syncLabel: string;
  syncEmpty: string;
  faceLabel: string;
  activityLabel: string;
}) {
  const collar = useCollar();
  const petId = collar.pet?.petId ?? null;
  const deviceHref = petId ? `/my/device?pet=${encodeURIComponent(petId)}` : "/my/device";
  const faceHref = petId ? `/my/collar/face?pet=${encodeURIComponent(petId)}` : "/my/collar/face";
  const real = collar.device.link === "connected" && collar.device.simulated === false && collar.simulated === false;
  const battery = real && typeof collar.device.batteryPercent === "number" ? collar.device.batteryPercent : null;
  const synced = real && collar.lastSyncAt ? new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(collar.lastSyncAt)) : null;

  const screen = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/collar/face-photo-240.png" alt="" className="h-[88px] w-[104px] shrink-0 rounded-[16px] border border-[#ead6c4] bg-[#e7f0f4] object-contain shadow-[0_8px_16px_-12px_rgba(20,24,18,0.85)]" />
  );

  if (!real) {
    return (
      <Link href={deviceHref} className="st-card-sway col-span-2 flex min-h-[112px] items-center justify-between gap-3 rounded-[20px] bg-[#1e4d3a] px-4 py-3 text-[#f6ebe3] shadow-[0_16px_28px_-12px_rgba(30,77,58,0.75)] ring-1 ring-[#55603a]">
        <span className="min-w-0">
          <span className="block text-[1.05rem] font-semibold leading-snug">{title}</span>
          <span className="mt-2 inline-flex min-h-9 items-center rounded-full bg-[#f6ebe3] px-3 text-sm font-semibold text-[#1e4d3a] shadow-[0_6px_12px_-8px_rgba(20,24,18,0.7)]">{connect}</span>
        </span>
        {screen}
      </Link>
    );
  }

  return (
    <section className="st-card-sway col-span-2 rounded-[20px] bg-[#1e4d3a] px-4 py-3 text-[#f6ebe3] shadow-[0_16px_28px_-12px_rgba(30,77,58,0.75)] ring-1 ring-[#55603a]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.05rem] font-semibold leading-snug">{title}</p>
          <p className="mt-1 truncate text-sm">{collar.device.deviceId}</p>
          {battery !== null ? <p className="mt-1 text-sm">{batteryLabel} {battery}%</p> : null}
          <p className="mt-1 text-sm text-[#e7f0f4]">{syncLabel} {synced ?? syncEmpty}</p>
        </div>
        {screen}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={faceHref} className="flex min-h-11 items-center justify-center rounded-[14px] bg-[#55603a] px-3 text-sm font-semibold text-[#f6ebe3]">{faceLabel}</Link>
        <Link href="/walks" className="flex min-h-11 items-center justify-center rounded-[14px] border border-[#ead6c4] bg-[#f6ebe3] px-3 text-sm font-semibold text-[#1e4d3a]">{activityLabel}</Link>
      </div>
    </section>
  );
}

function monthCover(recent: HomeRecent[], petId: string | null, monthKey: string) {
  const shots = recent.filter((item) => {
    if (item.kind !== "photo" || !item.imageUrl) return false;
    if (petId && item.petId !== petId) return false;
    return (item.happenedOn ?? item.createdAt).slice(0, 7) === monthKey;
  });
  return (shots.find((item) => item.favorite) ?? shots[0])?.imageUrl ?? null;
}

function seasonPose(month: number) {
  if (month >= 3 && month <= 5) return POSE_ART.shibaSpring;
  if (month >= 9 && month <= 11) return POSE_ART.shibaAutumn;
  return POSE_ART.shibaHome;
}

function CurrentPet({ pet }: { pet: HomePet }) {
  return (
    <div className="mt-4 flex min-w-0 items-center gap-3">
      <PetFace pet={pet} />
      <p className="min-w-0 truncate text-base font-semibold text-[#1e4d3a]">{pet.petName}</p>
    </div>
  );
}

function EmptyPets() {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  return (
    <section className="st-card mt-4 px-4 py-4">
      <p className="text-sm leading-6 text-[#1e4d3a]">{copy.emptyPets}</p>
      <Link href="/my/pets/new" className="st-btn st-btn-forest mt-3 w-full">{copy.createPet}</Link>
    </section>
  );
}

function PetFace({ pet }: { pet: HomePet }) {
  if (pet.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={pet.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={POSE_ART.shibaSpring} alt="" className="size-10 shrink-0 rounded-full bg-[#f6ebe3] object-contain" />
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
  const total = here.length + elsewhere.length + waiting.length;
  const currentShown = here.some((pet) => pet.petId === selectedId);
  if (total === 0 || (total === 1 && currentShown)) return null;
  return (
    <div className="mt-4 grid gap-3">
      {here.length > 0 ? (
        <ul className="flex gap-2 overflow-x-auto">
          {here.map((pet) => (
            <li key={pet.petId}>
              <Link
                href={entryHomePath(branch, pet.petId)}
                aria-current={pet.petId === selectedId ? "true" : undefined}
                className="inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-full border border-[#c9d7b8] bg-[#f3f7ea] px-3 text-sm font-semibold text-[#163e2e]"
              >
                <PetFace pet={pet} />
                <span className="min-w-0 truncate">{pet.petName}</span>
                {pet.species ? <span className="shrink-0 text-xs font-medium text-[#3e6274]">{pet.species}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {elsewhere.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-[#3e6274]">{otherLabel}</p>
          <ul className="mt-2 flex gap-2 overflow-x-auto">
            {elsewhere.map((pet) => (
              <li key={pet.petId}>
                <Link href={entryHomePath(branch === "living" ? "memorial" : "living", pet.petId)} className="inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-full border border-[#d9c2b0] px-3 text-sm text-[#1e4d3a]">
                  <PetFace pet={pet} />
                  <span className="min-w-0 truncate">{pet.petName}</span>
                  {pet.species ? <span className="shrink-0 text-xs">{pet.species}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {waiting.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-[#3e6274]">{confirmLabel}</p>
          <ul className="mt-2 grid gap-2">
            {waiting.map((pet) => (
              <li key={pet.petId}>
                <Link href={entryHomePath(branch, pet.petId)} className="inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-semibold text-[#1e4d3a]">
                  <PetFace pet={pet} />
                  <span className="min-w-0 truncate">{pet.petName}{pet.species ? ` · ${pet.species}` : ""} · {pickLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

