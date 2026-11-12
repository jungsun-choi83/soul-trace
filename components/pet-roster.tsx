"use client";

import { useLocale } from "@/components/locale-provider";
import { statusLabel, storyTabProps } from "@/components/pet-first-home";
import { StatusPill, StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryScene } from "@/components/storybook/story-scene";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { letterPathForLifeStatus } from "@/lib/pet-first-archive";
import { splitCurrentAndUnclassifiedPets } from "@/lib/pet-review";
import type { HomePet } from "@/lib/pet-first-archive-data";
import { petFirstCopy } from "@/lib/storybook-copy";
import { POSE_ART } from "@/lib/pose-art";
import Link from "next/link";

export function PetRoster({ pets }: { pets: HomePet[] }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const { current, unclassified } = splitCurrentAndUnclassifiedPets(pets);
  const active = current[0] ?? null;

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref="/dashboard" settingsHref="/settings" settingsLabel={copy.settingsTitle} />
        <UiuxHero src={POSE_ART.shibaAutumn} title={copy.myPets} body={copy.emptyPets} />

        {!pets.length ? (
          <section className="st-card mt-6 px-5 py-6">
            <StoryScene scene="portrait" className="rounded-[15px]" />
            <p className="mt-4 text-sm text-[color:var(--st-text-soft)]">{copy.emptyPets}</p>
            <Link href="/my/pets/new" className="st-btn st-btn-forest mt-5 w-full">{copy.createPet}</Link>
          </section>
        ) : (
          <>
            <p className="mt-6 text-sm text-[color:var(--st-text-soft)]">{copy.petsList}</p>
            <ul className="mt-3 grid gap-2">
              {pets.map((pet) => (
                <li key={pet.petId}>
                  <Link href={`/my/pets/${pet.petId}`} className="st-card flex min-h-16 items-center gap-3 px-4 py-3">
                    {pet.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.avatarUrl} alt="" className="size-14 rounded-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={POSE_ART.shibaSpring} alt="" className="size-14 rounded-full bg-[#f6efe2] object-contain object-center" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{pet.petName}</span>
                      <StatusPill tone={pet.lifeStatus === "living" ? "living" : "quiet"}>{statusLabel(copy, pet.lifeStatus)}</StatusPill>
                    </span>
                    <span aria-hidden="true" className="text-[#cbb58e]">›</span>
                  </Link>
                </li>
              ))}
            </ul>

            {unclassified.length > 0 ? (
              <Link href="/my/pets/review" className="st-card mt-4 block px-5 py-4" data-testid="pet-roster-review-link">
                <p className="font-medium">{lang === "en" ? "Review profiles without a status" : "상태 확인이 필요한 프로필"}</p>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">
                  {lang === "en"
                    ? `${unclassified.length} existing profile${unclassified.length === 1 ? "" : "s"} need review. Their IDs and saved records stay linked.`
                    : `기존 프로필 ${unclassified.length}개를 확인해 주세요. Pet ID와 저장된 기록은 그대로 연결됩니다.`}
                </p>
              </Link>
            ) : null}

            <Link href="/my/pets/new" className="st-btn st-btn-forest mt-5 w-full">{copy.addAnother}</Link>

            {active ? (
              <section className="st-card mt-6 px-5 py-5">
                <p className="font-medium">{copy.profileSpace}</p>
                <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.chooseStatusBody}</p>
              </section>
            ) : null}

            {active ? <nav className="mt-6 grid gap-3">
              <RosterLink href={`/my/pets/${active.petId}`} title={copy.timelineCardTitle} body={copy.timelineCardBody} />
              <RosterLink href={letterPathForLifeStatus(active.lifeStatus, active.petId)} title={copy.quickLetter} body={copy.letterCardBody} />
              <RosterLink href={`/polaroid?petId=${encodeURIComponent(active.petId)}`} title={copy.quickPolaroid} body={copy.polaroidCardBody} />
              <RosterLink href={`/beam-scene?pet=${encodeURIComponent(active.petId)}`} title={copy.makeBeamScene} body={copy.beamSceneBody} />
              {active.lifeStatus === "living" ? <RosterLink href={`/my/device?pet=${encodeURIComponent(active.petId)}`} title={copy.collarCardTitle} body={copy.collarCardBody} /> : null}
              {active.lifeStatus === "memorial" ? <RosterLink href={`/memorial-space?pet=${encodeURIComponent(active.petId)}`} title={copy.openMemorialSpace} body={copy.memorialSpaceBody} /> : null}
              <RosterLink href="/settings" title={copy.settingsTitle} body={copy.settingsBody} />
            </nav> : null}
          </>
        )}
      </main>
      <StoryTabbar current="pet" {...storyTabProps(copy, active?.petId ?? null, true, active?.lifeStatus ?? null)} />
    </div>
  );
}

function RosterLink({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="st-card block px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)]">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{body}</p>
    </Link>
  );
}
