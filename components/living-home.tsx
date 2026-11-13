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
    monthTitle: "이번 달의 추억",
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
    monthTitle: "This month",
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
        <section className="mt-4 overflow-hidden rounded-[22px] bg-[#f8f2e5] px-4 pb-5 pt-4">
          <h1 className="st-headline text-[clamp(1.25rem,5.4vw,1.55rem)] leading-snug !tracking-[-0.03em] text-[#3a452f]">{copy.title}</h1>
          <div className="mt-6 text-center">
            {birthdayDays !== null ? (
              <>
                <p className="text-sm font-medium text-[#7a8868]">{copy.ddayLabel}</p>
                <p className="mt-1 text-[clamp(3.4rem,16vw,4.6rem)] font-semibold leading-none tracking-[-0.06em] text-[#31402c]">
                  D+{birthdayDays.toLocaleString(lang === "en" ? "en-US" : "ko-KR")}
                </p>
              </>
            ) : (
              <>
                <p className="text-[clamp(3.4rem,16vw,4.6rem)] font-semibold leading-none tracking-[-0.06em] text-[#c5cdb8]">D+</p>
                <p className="mt-3 text-sm leading-5 text-[#7a8868]">{copy.ddayEmpty}</p>
              </>
            )}
          </div>
          {signedIn && petId ? <div className="mt-4"><FreePolaroidNotice petId={petId} /></div> : null}
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

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href={importHref} className="st-card-sway col-span-2 flex min-h-[112px] items-center justify-between gap-3 rounded-[20px] bg-[#d7e4cc] px-4 py-3 text-[#243226]">
            <span className="min-w-0">
              <span className="block text-[1.05rem] font-semibold leading-snug">{copy.importTitle}</span>
              <span className="mt-1 block text-sm leading-5 text-[#3d5340]">{copy.importBody}</span>
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/design/photo-stack.jpg" alt="" className="h-[88px] w-[104px] shrink-0 rounded-[16px] bg-[#fffdf8] object-contain" />
          </Link>

          <Link href={monthlyHref} className="st-card-sway relative block aspect-[169/280] overflow-hidden rounded-[20px] bg-[#f6dcc4] text-[#4a3424]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={monthPhoto ?? seasonPose(monthNumber)} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#f6dcc4] via-[#f6dcc4]/80 to-transparent px-3 pb-3 pt-10 text-right">
              <span className="block text-sm font-medium text-[#7a5b45]">{copy.monthTitle}</span>
              <span className="mt-0.5 block text-[2rem] font-semibold leading-none tracking-[-0.04em]">{monthNumber}월</span>
              {monthPhoto ? <span className="mt-1 block text-xs text-[#7a5b45]">{copy.cover}</span> : null}
            </span>
          </Link>

          <Link href={createHref} className="st-card-sway flex min-h-[176px] flex-col rounded-[20px] bg-[#31402c] p-3 text-[#f7f1e4]">
            <span>
              <span className="block text-[1.02rem] font-semibold leading-snug">{copy.createTitle}</span>
              <span className="mt-0.5 block text-sm leading-5 text-[#e7efe2]">{copy.createBody}</span>
            </span>
            <span className="mt-3 flex min-h-0 flex-1 items-stretch justify-center">
              <span className="flex w-full flex-col bg-[#fffaf1] p-1.5 pb-4">
                <span className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#f6efe6]">
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
    <img src="/images/collar/face-photo-240.png" alt="" className="h-[88px] w-[104px] shrink-0 rounded-[16px] border border-[#e4d56e] bg-[#fbf6d2] object-contain" />
  );

  if (!real) {
    return (
      <Link href={deviceHref} className="st-card-sway col-span-2 flex min-h-[112px] items-center justify-between gap-3 rounded-[20px] bg-[#f4e99a] px-4 py-3 text-[#4a4218]">
        <span className="min-w-0">
          <span className="block text-[1.05rem] font-semibold leading-snug">{title}</span>
          <span className="mt-2 inline-flex min-h-9 items-center rounded-full bg-[#31402c] px-3 text-sm font-semibold text-[#f7f1e4]">{connect}</span>
        </span>
        {screen}
      </Link>
    );
  }

  return (
    <section className="st-card-sway col-span-2 rounded-[20px] bg-[#f4e99a] px-4 py-3 text-[#4a4218]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[1.05rem] font-semibold leading-snug">{title}</p>
          <p className="mt-1 truncate text-sm">{collar.device.deviceId}</p>
          {battery !== null ? <p className="mt-1 text-sm">{batteryLabel} {battery}%</p> : null}
          <p className="mt-1 text-sm text-[#7a7040]">{syncLabel} {synced ?? syncEmpty}</p>
        </div>
        {screen}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={faceHref} className="flex min-h-11 items-center justify-center rounded-[14px] bg-[#31402c] px-3 text-sm font-semibold text-[#f7f1e4]">{faceLabel}</Link>
        <Link href="/walks" className="flex min-h-11 items-center justify-center rounded-[14px] bg-[#d7e4cc] px-3 text-sm font-semibold text-[#243226]">{activityLabel}</Link>
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

