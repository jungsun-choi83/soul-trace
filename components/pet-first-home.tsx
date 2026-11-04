"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { EternalBeamLogo } from "@/components/storybook/eternal-beam-logo";
import { StoryScene, type StorySceneName } from "@/components/storybook/story-scene";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { storyTabProps } from "@/lib/story-tabs";
import type { HomePet, HomeRecent } from "@/lib/pet-first-archive-data";
import { petFirstCopy, type LifeStatus, type PetSummary } from "@/lib/pet-first-archive";
import { fill, withKoreanWa, type PetFirstCopy } from "@/lib/storybook-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

export function PetFirstHome({
  initialPets,
  recent,
  today,
}: {
  initialPets: HomePet[];
  recent: HomeRecent[];
  today: string;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const [pets, setPets] = useState(initialPets);
  const [activeId, setActiveId] = useState(initialPets[0]?.petId ?? null);
  const active = pets.find((pet) => pet.petId === activeId) ?? pets[0] ?? null;
  const monthKey = today.slice(0, 7);
  const monthCount = active ? active.entryDays.filter((day) => day.startsWith(monthKey)).length : 0;
  const petHref = active ? `/my/pets/${active.petId}` : "/my/pets";
  const memorial = active?.lifeStatus === "memorial";
  const letterHref = active ? `/choose?petId=${encodeURIComponent(active.petId)}` : "/choose";

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 flex-col items-center text-[#6b4a2c]">
            <EternalBeamLogo className="h-8 w-auto" />
            <span className="font-display-en text-sm tracking-[0.06em]">SoulTrace</span>
          </Link>
          <LanguageToggle tone="paper" />
        </header>

        <section className="st-rise mt-4" aria-labelledby="home-title">
          <StoryScene scene={memorial ? "memorial" : "home"} priority className="rounded-[15px]" />
          <div className="relative mt-4 px-2">
            {memorial ? <p className="text-sm text-[color:var(--st-text-soft)]">{copy.memorialHomeEyebrow}</p> : null}
            <h1 id="home-title" className="st-headline whitespace-pre-line text-[1.75rem] text-[color:var(--st-text)] sm:text-4xl">
              {!active
                ? copy.homeTitleEmpty
                : memorial
                  ? fill(copy.memorialHomeTitle, { NAME: active.petName, NAMEWA: withKoreanWa(active.petName) })
                  : fill(copy.homeTitleWithPet, { NAME: active.petName, NAMEWA: withKoreanWa(active.petName) })}
            </h1>
            {!memorial ? (
              <p className="mt-3 text-[0.95rem] text-[color:var(--st-text-soft)]">
                {active ? copy.homeSubtitle : copy.homeSubtitleEmpty}
              </p>
            ) : null}
          </div>
        </section>

        {active ? (
          <nav aria-label={copy.myPets} className="mt-6 grid grid-cols-3 gap-3">
            {memorial ? (
              <>
                <QuickTile href={petHref} label={copy.quickMemorySpace} icon="spark" />
                <QuickTile href={letterHref} label={copy.quickLetter} icon="letter" />
                <QuickTile href={`/mood-journal?pet=${encodeURIComponent(active.petId)}`} label={copy.quickHeart} icon="heart" />
              </>
            ) : (
              <>
                <QuickTile href={`${petHref}#compose`} label={copy.quickRecord} icon="pen" />
                <QuickTile href={letterHref} label={copy.quickLetter} icon="letter" />
                <QuickTile href="/polaroid" label={copy.quickPolaroid} icon="polaroid" />
              </>
            )}
          </nav>
        ) : null}

        {pets.length > 1 ? (
          <nav aria-label={copy.myPets} className="mt-8">
            <p className="st-eyebrow">{copy.myPets}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {pets.map((pet) => (
                <li key={pet.petId}>
                  <button
                    type="button"
                    aria-pressed={pet.petId === active?.petId}
                    onClick={() => setActiveId(pet.petId)}
                    className={`st-btn ${pet.petId === active?.petId ? "st-btn-sage" : "st-btn-quiet"} min-h-11 px-4 text-sm`}
                  >
                    {pet.petName}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {active ? (
          <>
            {!memorial ? (
              <section className="mt-10" aria-labelledby="walk-title">
                <h2 id="walk-title" className="st-headline text-xl">{copy.walkTitle}</h2>
                <div className="st-card mt-3 px-5 py-4" aria-disabled="true">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{copy.walkCardTitle}</p>
                    <span className="shrink-0 rounded-full bg-[color:var(--st-beige)] px-2.5 py-1 text-xs">{copy.soon}</span>
                  </div>
                  <p className="mt-1 text-sm text-[color:var(--st-text-soft)]">{copy.walkCardBody}</p>
                </div>
              </section>
            ) : null}

            <RecentScenes copy={copy} title={memorial ? copy.sharedScenes : copy.recentTitle} recent={recent.filter((item) => item.petId === active.petId)} petHref={petHref} />

            {memorial ? (
              <section className="mt-10" aria-labelledby="quiet-title">
                <h2 id="quiet-title" className="st-headline text-xl">{copy.quietTitle}</h2>
                <div className="st-card mt-3 px-5 py-5">
                  <p className="st-pen text-xl leading-snug text-[color:var(--st-brown)]">{copy.quietBody}</p>
                  <Link href={`${petHref}#memorial`} className="st-btn st-btn-quiet mt-4 w-full">{copy.quietCta}</Link>
                </div>
                <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.noReminder}</p>
              </section>
            ) : null}

            <section aria-label={copy.myPets} className="mt-10 grid gap-4 sm:grid-cols-2">
              <StoryCard scene="monthly" title={copy.monthlyCardTitle} href={`${petHref}#monthly`}>
                {monthCount > 0 ? fill(copy.monthlyCardBody, { COUNT: monthCount }) : copy.monthlyCardBodyEmpty}
              </StoryCard>
              <StoryCard scene="timeline" title={copy.timelineCardTitle} href={`${petHref}#album`}>
                {copy.timelineCardBody}
              </StoryCard>
              <StoryCard scene="letter" title={copy.letterCardTitle} href={letterHref}>
                {copy.letterCardBody}
              </StoryCard>
              {!memorial ? (
                <StoryCard scene="home" title={copy.collarCardTitle} href={`/my/device?pet=${encodeURIComponent(active.petId)}`}>
                  {copy.collarCardBody}
                </StoryCard>
              ) : (
                <StoryCard scene="memorial" title={copy.openMemorialSpace} href={`/memorial-space?pet=${encodeURIComponent(active.petId)}`}>
                  {copy.memorialSpaceBody}
                </StoryCard>
              )}
            </section>

            <details className="st-card mt-10 px-5 py-4">
              <summary className="st-headline min-h-11 cursor-pointer py-2 text-lg">{copy.addAnother}</summary>
              <RegisterForm copy={copy} onCreated={(created) => {
                setPets((current) => [created, ...current.filter((pet) => pet.petId !== created.petId)]);
                setActiveId(created.petId);
              }} />
            </details>
          </>
        ) : (
          <section className="st-card mt-10 px-5 py-6 sm:px-7" aria-labelledby="register-title">
            <h2 id="register-title" className="st-headline text-xl">{copy.registerTitle}</h2>
            <p className="mt-2 text-sm text-[color:var(--st-text-soft)]">{copy.registerBody}</p>
            <RegisterForm copy={copy} onCreated={(created) => {
              setPets([created]);
              setActiveId(created.petId);
            }} />
          </section>
        )}

        <p className="mt-8 text-center text-xs text-[color:var(--st-text-soft)]">{copy.noPayment}</p>
      </main>

      <StoryTabbar current="home" {...storyTabProps(copy, active?.petId ?? null, true, active?.lifeStatus ?? null)} />
    </div>
  );
}

export { storyTabHrefs, storyTabProps } from "@/lib/story-tabs";

type QuickIcon = "pen" | "letter" | "polaroid" | "spark" | "heart";

function QuickTile({ href, label, icon }: { href: string; label: string; icon: QuickIcon }) {
  return (
    <Link href={href} className="st-card flex min-h-24 flex-col items-center justify-center gap-2 px-2 py-4 text-center text-sm font-medium transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)]">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 text-[color:var(--st-brown)]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {icon === "pen" ? <path d="m14.5 5.5 4 4L9 19H5v-4l9.5-9.5Z" /> : null}
        {icon === "letter" ? <><rect x="3.5" y="6" width="17" height="12" rx="2.5" /><path d="m4.5 7.5 7.5 6 7.5-6" /></> : null}
        {icon === "polaroid" ? <><rect x="5" y="4" width="14" height="16" rx="1.5" /><rect x="7.5" y="6.5" width="9" height="8.5" rx="0.5" /></> : null}
        {icon === "spark" ? <path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2L12 3.5Z" /> : null}
        {icon === "heart" ? <path d="M12 19.5c-5-3.5-8-6.4-8-10a4 4 0 0 1 8-1.5 4 4 0 0 1 8 1.5c0 3.6-3 6.5-8 10Z" /> : null}
      </svg>
      {label}
    </Link>
  );
}

function RecentScenes({ copy, title, recent, petHref }: { copy: PetFirstCopy; title: string; recent: HomeRecent[]; petHref: string }) {
  return (
    <section className="mt-10" aria-labelledby="recent-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recent-title" className="st-headline text-xl">{title}</h2>
        {recent.length ? <Link href={`${petHref}#album`} className="st-link text-sm">{copy.timelineCardTitle}</Link> : null}
      </div>
      {recent.length === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.recentEmpty}</p>
      ) : (
        <ul className="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3">
          {recent.map((item, index) => (
            <li key={item.entryId} className={`w-40 shrink-0 snap-start ${index % 2 ? "rotate-1" : "-rotate-1"}`}>
              <Link href={`${petHref}#album`} className="st-polaroid block">
                {item.imageUrl ? (
                  // Signed storage URLs expire and are outside the image optimizer allowlist.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title || item.petName} className="aspect-square w-full rounded-md object-cover" />
                ) : (
                  <span className="flex aspect-square w-full items-center rounded-md bg-[color:var(--st-cream)] p-3 text-sm leading-relaxed text-[color:var(--st-ink)]">
                    <span className="line-clamp-5">{item.story || item.title || copy.storyTab}</span>
                  </span>
                )}
                <span className="st-pen mt-2 block truncate text-lg text-[color:var(--st-ink-soft)]">
                  {item.title || (item.happenedOn ?? item.createdAt.slice(0, 10))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StoryCard({ scene, title, href, children }: { scene: StorySceneName; title: string; href: string; children: string }) {
  return (
    <Link href={href} className="st-card group block overflow-hidden transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--st-focus)]">
      <StoryScene scene={scene} className="rounded-none" />
      <span className="block px-5 py-4">
        <span className="st-headline block text-lg">{title}</span>
        <span className="mt-1 block text-sm text-[color:var(--st-text-soft)]">{children}</span>
      </span>
    </Link>
  );
}

function RegisterForm({ copy, onCreated }: { copy: PetFirstCopy; onCreated: (pet: HomePet) => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(false);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/my/pets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        petName: form.get("petName"),
        species: form.get("species"),
        birthday: form.get("birthday"),
        adoptedOn: form.get("adoptedOn"),
        lifeStatus: form.get("lifeStatus"),
        traits: form.get("traits"),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    const created = await response.json() as PetSummary;
    onCreated({ ...created, entryDays: [], letterCount: 0, avatarUrl: null });
    router.push(`/my/pets/${created.petId}#compose`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" aria-busy={saving}>
      <Field id="pet-name" label={copy.name} hint={copy.required} strong>
        <input id="pet-name" name="petName" required maxLength={40} autoComplete="nickname" placeholder={copy.namePlaceholder} className="st-field" />
      </Field>
      <p className="-mt-2 text-xs text-[color:var(--st-text-soft)]">{copy.sameNameHint}</p>
      <Field id="pet-species" label={copy.species} hint={copy.optional}>
        <input id="pet-species" name="species" maxLength={40} placeholder={copy.speciesPlaceholder} className="st-field" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pet-birthday" label={copy.birthday} hint={copy.optional}>
          <input id="pet-birthday" name="birthday" type="date" className="st-field" />
        </Field>
        <Field id="pet-adopted" label={copy.adopted} hint={copy.optional}>
          <input id="pet-adopted" name="adoptedOn" type="date" className="st-field" />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">{copy.status}</legend>
        <div className="mt-2 grid gap-2">
          {(["living", "memorial", "unspecified"] as LifeStatus[]).map((value) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-[color:var(--st-field-edge)] bg-[color:var(--st-field)] px-4 text-sm has-[:checked]:border-[color:var(--st-sage-deep)] has-[:checked]:bg-[color:var(--st-sage)]/15">
              <input type="radio" name="lifeStatus" value={value} defaultChecked={value === "unspecified"} className="accent-[color:var(--st-sage-deep)]" />
              {statusLabel(copy, value)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="pet-traits" label={copy.traits} hint={copy.optional}>
        <textarea id="pet-traits" name="traits" maxLength={500} rows={3} placeholder={copy.traitsPlaceholder} className="st-field" />
      </Field>
      {error ? <StoryState kind="error" title={copy.saveError} /> : null}
      <button type="submit" disabled={saving} className="st-btn st-btn-primary w-full sm:w-auto">
        {saving ? copy.saving : copy.savePet}
      </button>
    </form>
  );
}

function Field({ id, label, hint, strong = false, children }: { id: string; label: string; hint: string; strong?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label} <span className={strong ? "text-[color:var(--st-brown)]" : "font-normal text-[color:var(--st-text-soft)]"}>({hint})</span>
      </label>
      {children}
    </div>
  );
}

export function statusLabel(copy: PetFirstCopy, status: LifeStatus) {
  if (status === "living") return copy.living;
  if (status === "memorial") return copy.memorial;
  return copy.unspecified;
}
