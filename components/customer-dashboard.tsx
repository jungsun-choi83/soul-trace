"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader } from "@/components/storybook/story-chrome";
import { StoryScene } from "@/components/storybook/story-scene";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { beamSceneHref, memorialSpaceHref, moodJournalHref, polaroidHrefFromArchive } from "@/lib/memory-library";
import { POSE_ART } from "@/lib/pose-art";
import { letterPathForLifeStatus, type LifeStatus } from "@/lib/pet-first-archive";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { fill, petFirstCopy, withKoreanWa, type PetFirstCopy } from "@/lib/storybook-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function CustomerDashboard({
  initialPets,
  recent,
  selectedPetId,
}: {
  initialPets: HomePet[];
  recent: HomeRecent[];
  selectedPetId?: string | null;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const router = useRouter();
  const [activeId, setActiveId] = useState(selectedPetId && initialPets.some((pet) => pet.petId === selectedPetId)
    ? selectedPetId
    : initialPets[0]?.petId ?? null);
  const [chosen, setChosen] = useState<Partial<Record<string, LifeStatus>>>({});
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchError, setBranchError] = useState(false);
  const active = useMemo(
    () => initialPets.find((pet) => pet.petId === activeId) ?? initialPets[0] ?? null,
    [activeId, initialPets],
  );
  const status = (active && chosen[active.petId]) || active?.lifeStatus || "unspecified";

  async function chooseBranch(next: "living" | "memorial") {
    if (!active || savingBranch) return;
    setBranchError(false);
    setSavingBranch(true);
    const response = await fetch(`/api/my/pets/${active.petId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifeStatus: next }),
    });
    setSavingBranch(false);
    if (!response.ok) {
      setBranchError(true);
      return;
    }
    setChosen((current) => ({ ...current, [active.petId]: next }));
    router.refresh();
  }
  const petRecent = recent.filter((item) => !active || item.petId === active.petId);
  const albumHref = active ? `/my/pets/${active.petId}` : "/my/pets";
  const letterHref = active ? letterPathForLifeStatus(status, active.petId) : "/choose";

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader settingsHref="/settings" settingsLabel={copy.settingsTitle} homeHref="/" />

        {!active ? (
          <section className="st-card mt-8 overflow-hidden px-5 py-6">
            <StoryScene scene="home" className="rounded-[15px]" />
            <h1 className="st-headline mt-5 text-2xl">{copy.branchTitle}</h1>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.branchBody}</p>
            <div className="mt-5 grid gap-3">
              <Link href="/my/pets/new?status=living" className="st-card block px-5 py-4">
                <p className="font-medium">{copy.living}</p>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.branchLivingBody}</p>
              </Link>
              <Link href="/my/pets/new?status=memorial" className="st-card block px-5 py-4">
                <p className="font-medium">{copy.memorial}</p>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.branchMemorialBody}</p>
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="st-rise mt-4">
              <h1 className="st-headline whitespace-pre-line text-center text-[1.7rem] leading-snug">
                {status === "memorial"
                  ? fill(copy.memorialHomeTitle, { NAME: active.petName, NAMEWA: withKoreanWa(active.petName) })
                  : status === "living"
                    ? fill(copy.homeTitleWithPet, { NAME: active.petName, NAMEWA: withKoreanWa(active.petName) })
                    : copy.branchTitle}
              </h1>
              <PetHero pet={active} />
            </section>

            {initialPets.length > 1 ? (
              <nav aria-label={copy.myPets} className="mt-6 flex flex-wrap gap-2">
                {initialPets.map((pet) => (
                  <button
                    key={pet.petId}
                    type="button"
                    aria-pressed={pet.petId === active.petId}
                    onClick={() => setActiveId(pet.petId)}
                    className={`st-btn ${pet.petId === active.petId ? "st-btn-sage" : "st-btn-quiet"} min-h-11 px-4 text-sm`}
                  >
                    {pet.petName}
                  </button>
                ))}
              </nav>
            ) : null}

            <HomeBranch copy={copy} status={status} saving={savingBranch} error={branchError} onChoose={(next) => void chooseBranch(next)} />

            {status === "unspecified" ? null : (
            <>
            <nav className="mt-6 grid grid-cols-4 gap-2" aria-label={copy.tabs.home}>
              <DashTile href={`${albumHref}#album`} label={copy.archiveTile} icon="archive" />
              <DashTile href={letterHref} label={copy.quickLetter} icon="letter" />
              <DashTile href={polaroidHrefFromArchive(active.petId)} label={copy.quickPolaroid} icon="polaroid" />
              {status === "memorial" ? (
                <DashTile href={memorialSpaceHref(active.petId)} label={copy.openMemorialSpace} icon="pet" />
              ) : (
                <DashTile href={status === "living" ? `/my/pets/${active.petId}` : `/my/pets/${active.petId}/edit`} label={copy.tabs.pet} icon="pet" />
              )}
            </nav>

            {status === "living" ? (
              <section className="st-card mt-6 overflow-hidden" aria-disabled="true">
                <p className="st-eyebrow px-5 pt-4">{copy.walkTitle}</p>
                <div className="flex items-start justify-between gap-3 px-5 pt-2">
                  <div>
                    <h2 className="font-medium">{copy.walkCardTitle}</h2>
                    <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.walkCardBody}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[color:var(--st-beige)] px-2.5 py-1 text-xs">{copy.soon}</span>
                </div>
                <StoryScene scene="timeline" className="mt-3 rounded-none" />
              </section>
            ) : null}

            {status === "memorial" ? (
              <>
                <Link href={memorialSpaceHref(active.petId)} className="st-card mt-6 block px-5 py-4">
                  <h2 className="font-medium">{copy.openMemorialSpace}</h2>
                  <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.memorialSpaceBody}</p>
                </Link>
                <Link href={moodJournalHref(active.petId)} className="st-card mt-6 block px-5 py-4">
                  <h2 className="font-medium">{copy.openMoodJournal}</h2>
                  <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.moodJournalBody}</p>
                </Link>
                <section className="st-card mt-6 px-5 py-5">
                  <p className="st-pen text-2xl text-[color:var(--st-brown)]">{copy.quietBody}</p>
                </section>
                <p className="mt-4 text-xs text-[color:var(--st-text-soft)]">{copy.noReminder}</p>
              </>
            ) : null}
            </>
            )}

            <section className="mt-8">
              <div className="flex items-baseline justify-between">
                <h2 className="st-headline text-xl">{status === "memorial" ? copy.sharedScenes : copy.recentTitle}</h2>
                <Link href={`${albumHref}#album`} className="st-link text-sm">{copy.timelineCardTitle}</Link>
              </div>
              {petRecent.length === 0 ? (
                <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.recentEmpty}</p>
              ) : (
                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {petRecent.slice(0, 6).map((item) => (
                    <li key={item.entryId}>
                      <Link href={`${albumHref}#album`} className="block overflow-hidden rounded-[12px] bg-[#f8f2e5]">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt={item.title || item.petName} className="aspect-square w-full object-cover" />
                        ) : (
                          <span className="flex aspect-square items-center p-2 text-xs">{item.story || item.title}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {status === "living" ? (
              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="st-headline text-xl">{copy.todayPicks}</h2>
                  <Link href={`${albumHref}#album`} className="st-link text-sm">{copy.timelineCardTitle}</Link>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Link href={`${albumHref}#album`} className="st-card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={POSE_ART.shibaHome} alt="" className="aspect-[5/3] w-full bg-[#f6efe2] object-contain object-center" />
                    <div className="px-4 py-3">
                      <h3 className="font-medium">{copy.tidyMemories}</h3>
                      <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.tidyMemoriesBody}</p>
                    </div>
                  </Link>
                  <Link href={`${albumHref}#album`} className="st-card overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={POSE_ART.corgiSpring} alt="" className="aspect-[5/3] w-full bg-[#f6efe2] object-contain object-center" />
                    <div className="px-4 py-3">
                      <h3 className="font-medium">{copy.monthBest}</h3>
                      <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{fill(copy.monthBestBody, { NAME: active.petName })}</p>
                    </div>
                  </Link>
                </div>
              </section>
            ) : null}

            {status === "unspecified" ? null : (
              <Link href={beamSceneHref(active.petId)} className="st-card mt-6 block px-5 py-4">
                <h2 className="font-medium">{copy.makeBeamScene}</h2>
                <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.beamSceneBody}</p>
              </Link>
            )}

            <div className="mt-8 flex gap-3">
              <Link href={`/my/pets/${active.petId}/edit`} className="st-btn st-btn-quiet flex-1">{copy.editPet}</Link>
              <Link href="/my/pets/new" className="st-btn st-btn-quiet flex-1">{copy.addAnother}</Link>
            </div>
          </>
        )}
      </main>
      <StoryTabbar current="home" {...storyTabProps(copy, active?.petId ?? null, true, status)} />
    </div>
  );
}

function HomeBranch({
  copy,
  status,
  saving,
  error,
  onChoose,
}: {
  copy: PetFirstCopy;
  status: LifeStatus;
  saving: boolean;
  error: boolean;
  onChoose: (next: "living" | "memorial") => void;
}) {
  return (
    <section className="mt-6" aria-labelledby="home-branch">
      <h2 id="home-branch" className="st-headline text-xl">{status === "unspecified" ? copy.branchTitle : copy.statusLabel}</h2>
      <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.branchBody}</p>
      <div className="mt-4 grid gap-3">
        <button type="button" aria-pressed={status === "living"} disabled={saving} onClick={() => onChoose("living")} className={`st-card px-5 py-4 text-left ${status === "living" ? "ring-2 ring-[color:var(--st-sage-deep)]" : ""}`}>
          <p className="font-medium">{copy.living}</p>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.branchLivingBody}</p>
        </button>
        <button type="button" aria-pressed={status === "memorial"} disabled={saving} onClick={() => onChoose("memorial")} className={`st-card px-5 py-4 text-left ${status === "memorial" ? "ring-2 ring-[color:var(--st-sage-deep)]" : ""}`}>
          <p className="font-medium">{copy.memorial}</p>
          <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.branchMemorialBody}</p>
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-[#8a4b32]">{copy.branchSaveError}</p> : null}
    </section>
  );
}

function PetHero({ pet }: { pet: HomePet }) {
  const src = pet.avatarUrl || POSE_ART.shibaHome;
  return (
    <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-[22px] bg-[#f8f2e5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`h-full w-full object-center ${pet.avatarUrl ? "object-cover" : "object-contain"}`} />
    </div>
  );
}


function DashTile({ href, label, icon }: { href: string; label: string; icon: "archive" | "letter" | "polaroid" | "pet" }) {
  return (
    <Link href={href} className="flex min-h-[5.5rem] flex-col items-center justify-center gap-1.5 rounded-[18px] bg-[#fff7ea] px-1 py-3 text-center shadow-[0_8px_18px_-14px_rgba(90,61,39,0.5)]">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-[#f4e6cf] text-[#6b4a2c]">
        <DashIcon icon={icon} />
      </span>
      <span className="text-[11px] font-medium leading-4 text-[#463021]">{label}</span>
    </Link>
  );
}

function DashIcon({ icon }: { icon: "archive" | "letter" | "polaroid" | "pet" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {icon === "archive" ? (
        <>
          <path d="M6 7h12v12H6z" />
          <path d="M8 5h8v3H8z" />
          <circle cx="12" cy="14" r="1.4" />
        </>
      ) : icon === "letter" ? (
        <>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m5 8 7 5 7-5" />
        </>
      ) : icon === "polaroid" ? (
        <>
          <rect x="6" y="4" width="12" height="16" rx="1.5" />
          <rect x="8" y="6" width="8" height="8" rx="0.5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="14" r="4" />
          <circle cx="7.5" cy="9" r="1.6" />
          <circle cx="12" cy="7" r="1.6" />
          <circle cx="16.5" cy="9" r="1.6" />
        </>
      )}
    </svg>
  );
}
