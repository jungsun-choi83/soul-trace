"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryState } from "@/components/storybook/story-state";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { memorialSpaceHref } from "@/lib/memory-library";
import type { PetProfile } from "@/lib/pet-first-archive-data";
import { GUEST_PREVIEW_PET_ID, petFirstCopy } from "@/lib/pet-first-archive";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type MoodEntry = { entryId: string; story: string; createdAt: string; visibility: "private" };

export function MoodJournal({ profile }: { profile: PetProfile }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const petId = profile.petId;
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (petId === GUEST_PREVIEW_PET_ID) {
      setEntries([]);
      setLoading(false);
      setError(false);
      return;
    }
    const response = await fetch(`/api/my/pets/${petId}/mood-journal`);
    setLoading(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    const body = await response.json() as { entries?: MoodEntry[] };
    setEntries(body.entries ?? []);
    setError(false);
  }, [petId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const story = String(new FormData(form).get("story") ?? "");
    setSaving(true);
    setError(false);
    const response = await fetch(`/api/my/pets/${petId}/mood-journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ story }),
    });
    setSaving(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    form.reset();
    setNotice(copy.saved);
    void load();
  }

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref={memorialSpaceHref(petId)} backLabel={copy.openMemorialSpace} />

        <section className="st-rise mt-3">
          <UiuxHero title={copy.moodJournalTitle} body={copy.moodJournalBody} />
          <div className="relative mt-4 px-2">
            <p className="st-eyebrow">{copy.moodJournalEyebrow}</p>
            <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.heartPrivate}</p>
          </div>
        </section>

        <form onSubmit={save} className="st-card mt-8 space-y-3 px-5 py-5" aria-busy={saving}>
          <label htmlFor="mood-body" className="block text-sm font-medium">{copy.heartTitle}</label>
          <textarea id="mood-body" name="story" required maxLength={2000} rows={5} placeholder={copy.heartPlaceholder} className="st-field" />
          <button type="submit" disabled={saving} className="st-btn st-btn-sage w-full">{saving ? copy.saving : copy.heartSave}</button>
        </form>

        <aside className="mt-4 space-y-2 text-xs text-[color:var(--st-text-soft)]">
          <p>{copy.moodShareDisabled}</p>
          <p>{copy.moodAlertDisabled}</p>
          <p>{copy.noReminder}</p>
        </aside>
        <div className="mt-3" aria-disabled="true">
          <button type="button" disabled className="st-btn st-btn-quiet w-full opacity-60">{copy.settingsFamily}</button>
        </div>

        <div className="mt-4 space-y-3" aria-live="polite">
          {notice ? <StoryState kind="success" title={notice} /> : null}
          {error ? <StoryState kind="error" title={copy.saveError} /> : null}
        </div>

        <section className="mt-10">
          <h2 className="st-headline text-xl">{profile.petName}</h2>
          {loading ? <StoryState kind="loading" title={copy.loading} /> : null}
          {!loading && !entries.length ? <p className="mt-3 text-sm text-[color:var(--st-text-soft)]">{copy.quietBody}</p> : null}
          <ul className="mt-4 space-y-3">
            {entries.map((entry) => (
              <li key={entry.entryId} className="st-card px-5 py-4">
                <p className="text-xs text-[color:var(--st-text-soft)]">{entry.createdAt.slice(0, 10)} · {copy.heartPrivate}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{entry.story}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <StoryTabbar current="home" {...storyTabProps(copy, petId, true, "memorial")} />
    </div>
  );
}
