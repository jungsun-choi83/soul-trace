"use client";

import { useLocale } from "@/components/locale-provider";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import {
  entryHomePath,
  petsOnBranch,
  petsOnOtherBranch,
} from "@/lib/entry-branch";
import { recentMemoriesForPet } from "@/lib/home-memory-preview";
import { memorialSpaceHref, memoriesHref, memoriesMonthHref } from "@/lib/memory-library";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { CLEAN_ART } from "@/lib/design-art";
import { POSE_ART } from "@/lib/pose-art";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리 아이와 함께했던 소중한 순간들",
    lead: "소중했던 기억은 언제나 이곳에 있어요.",
    import: "우리 아이 추억 사진 가져오기",
    scenes: "언제든 다시 꺼내는 추억",
    more: "추억 더 보기",
    hallTitle: "추모관 들어가기",
    hallBody: "보고 싶을 때만 들어가요.",
    createTitle: "우리의 특별한 추억",
    createBody: "편지와 폴라로이드",
    monthTitle: "이번 달의 추억",
    monthBody: "사진을 날짜별로 살펴보세요.",
    other: "지금 함께 있는 아이",
    confirm: "상태 확인이 필요한 아이",
    pick: "프로필에서 확인",
  },
  en: {
    title: "The moments we shared",
    lead: "The memories you keep are here whenever you want them.",
    import: "Bring in photos of our pet",
    scenes: "Memories to open again",
    more: "See more",
    hallTitle: "Open the memorial space",
    hallBody: "Open only when you want to.",
    createTitle: "Our special memories",
    createBody: "Letter and polaroid",
    monthTitle: "This month",
    monthBody: "Look through photos by date.",
    other: "Pets who are here now",
    confirm: "Pets waiting for a status",
    pick: "Confirm on the profile",
  },
} as const;

const FALLBACK_SCENES = [CLEAN_ART.memorialHero, POSE_ART.shibaAutumn, POSE_ART.corgiHome];

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
  const memorialPetId = selected?.lifeStatus === "memorial" ? selected.petId : (here.find((pet) => pet.lifeStatus === "memorial")?.petId ?? null);
  const memories = recentMemoriesForPet(recent, petId);
  const photos = memories.filter((item) => item.kind === "photo" && item.imageUrl).slice(0, 3);
  const hero = photos[0]?.imageUrl ?? CLEAN_ART.memorialHero;
  const scenes = photos.length > 0 ? photos.map((item) => item.imageUrl as string) : FALLBACK_SCENES;
  const recordHref = petId ? `/my/pets/${encodeURIComponent(petId)}/memories/record` : "/my/pets/new?status=memorial";
  const albumHref = petId ? `/my/pets/${encodeURIComponent(petId)}/memories#album` : memoriesHref(null, "memorial");
  const importHref = signedIn ? recordHref : memoriesHref(petId, "memorial");
  const monthlyHref = memoriesMonthHref(petId, null, "memorial");
  const createHref = petId ? `/create?pet=${encodeURIComponent(petId)}&branch=memorial` : "/create?branch=memorial";
  const hallHref = memorialPetId ? memorialSpaceHref(memorialPetId) : "/memorial-space";

  return (
    <div data-testid="memorial-home" className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-8 pt-4">
        <StoryBrandHeader homeHref={entryHomePath("memorial", petId)} settingsHref="/settings" settingsLabel={tabs.settingsTitle} />

        <section className="relative mt-4 overflow-hidden rounded-[22px] bg-[#1d2430]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" className="aspect-[16/10] w-full object-cover object-[center_42%]" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1c2430] via-[#1c2430]/75 to-transparent px-4 pb-4 pt-16 text-white">
            <h1 className="st-headline text-[clamp(1.25rem,5.4vw,1.55rem)] leading-snug !tracking-[-0.03em]">{copy.title}</h1>
            <p className="mt-1 text-sm leading-5 text-white/85">{copy.lead}</p>
          </div>
        </section>

        <Link href={importHref} className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-[#31402c] px-4 text-center text-sm font-semibold text-[#f7f1e4]">
          {copy.import}
        </Link>

        <section className="mt-6" aria-labelledby="memorial-scenes">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="memorial-scenes" className="st-headline text-lg text-[#1e4d3a]">{copy.scenes}</h2>
            <Link href={albumHref} className="shrink-0 text-sm text-[#3e6274]">{copy.more}</Link>
          </div>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {scenes.slice(0, 3).map((src, index) => (
              <li key={`${src}-${index}`}>
                <Link href={albumHref} className="block overflow-hidden rounded-[16px] bg-[#efe6d6]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square w-full object-cover object-center" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-4 grid gap-3">
          <ActionRow href={hallHref} title={copy.hallTitle} body={copy.hallBody} mark="hall" />
          <ActionRow href={createHref} title={copy.createTitle} body={copy.createBody} mark="create" />
          <ActionRow href={monthlyHref} title={copy.monthTitle} body={copy.monthBody} mark="month" />
        </div>

        {selected ? <CurrentPet pet={selected} /> : null}
        {signedIn && pets.length === 0 ? <EmptyPets /> : null}

        <PetSwitch
          here={here}
          elsewhere={elsewhere}
          waiting={waiting}
          selectedId={petId}
          otherLabel={copy.other}
          confirmLabel={copy.confirm}
          pickLabel={copy.pick}
        />
      </main>
      <StoryTabbar current="home" {...storyTabProps(tabs, petId, signedIn, "memorial")} />
    </div>
  );
}

function ActionRow({
  href,
  title,
  body,
  mark,
}: {
  href: string;
  title: string;
  body: string;
  mark: "hall" | "create" | "month";
}) {
  return (
    <Link href={href} className="flex min-h-[72px] items-center gap-3 rounded-[20px] border border-[#eadfce] bg-[#f8f1ea] px-3 py-3 text-[#1e4d3a]">
      <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${mark === "create" ? "bg-[#e7efe2] text-[#31402c]" : "bg-[#ece7f3] text-[#5c5478]"}`} aria-hidden="true">
        {mark === "hall" ? "＋" : mark === "create" ? "✧" : "▣"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug">{title}</span>
        <span className="mt-0.5 block text-sm leading-5 text-[#3e6274]">{body}</span>
      </span>
      <span aria-hidden="true" className="text-[#b7a894]">›</span>
    </Link>
  );
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
  otherLabel,
  confirmLabel,
  pickLabel,
}: {
  here: HomePet[];
  elsewhere: HomePet[];
  waiting: HomePet[];
  selectedId: string | null;
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
                href={entryHomePath("memorial", pet.petId)}
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
                <Link href={entryHomePath("living", pet.petId)} className="inline-flex min-h-11 max-w-[16rem] items-center gap-2 rounded-full border border-[#d9c2b0] px-3 text-sm text-[#1e4d3a]">
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
                <Link href={entryHomePath("memorial", pet.petId)} className="inline-flex min-h-11 max-w-full items-center gap-2 text-sm font-semibold text-[#1e4d3a]">
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
