"use client";

import { useLocale } from "@/components/locale-provider";
import { storyTabProps } from "@/components/pet-first-home";
import { StoryBrandHeader, UiuxHero } from "@/components/storybook/story-chrome";
import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { petFirstCopy } from "@/lib/storybook-copy";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { UIUX_ROOM_ART } from "@/lib/uiux-art";
import Link from "next/link";
import { useState } from "react";

export function AccountSettings({ email, petId }: { email: string | null; petId: string | null }) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await createSupabaseBrowserAuthClient().auth.signOut({ scope: "local" });
    } catch {
      // Still leave the settings page so a broken client cannot trap the visitor.
    }
    window.location.assign("/");
  }

  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-8 pt-5 sm:pt-8">
        <StoryBrandHeader backHref="/dashboard" />
        <UiuxHero src={UIUX_ROOM_ART} title={copy.settingsLead} body={copy.settingsBody} />

        <h2 className="st-headline mt-8 text-xl">{copy.settingsAccount}</h2>
        <ul className="mt-3 grid gap-2">
          <SettingsRow label={copy.accountLogin} value={email || "—"} />
          <SettingsRow label={copy.settingsPrivacy} value={copy.settingsPrivacyValue} />
          <SettingsRow label={copy.settingsFamily} soon={copy.soon} />
          <SettingsRow label={copy.settingsPremium} soon={copy.soon} />
        </ul>

        <h2 className="st-headline mt-8 text-xl">{copy.settingsAlerts}</h2>
        <ul className="mt-3 grid gap-2">
          <SettingsRow label={copy.settingsNotifyMonthly} value={copy.off} />
          <SettingsRow label={copy.settingsNotifyMemorial} value={copy.off} />
        </ul>
        <p className="mt-3 text-xs text-[color:var(--st-text-soft)]">{copy.noReminder}</p>

        <h2 className="st-headline mt-8 text-xl">{copy.settingsMine}</h2>
        <ul className="mt-3 grid gap-2">
          <SettingsRow label={copy.settingsExport} soon={copy.soon} />
          <SettingsRow label={copy.settingsDelete} soon={copy.soon} />
        </ul>

        <section className="st-card mt-6 px-5 py-5">
          <p className="st-eyebrow">{copy.accountEmail}</p>
          <p className="mt-2 break-all text-sm">{email || "—"}</p>
        </section>
        <p className="mt-4 text-sm text-[color:var(--st-text-soft)]">{copy.settingsTagline}</p>

        <div className="mt-6 grid gap-3">
          <Link href="/privacy-policy" className="st-btn st-btn-quiet w-full">{copy.privacyLink}</Link>
          <Link href="/terms-of-service" className="st-btn st-btn-quiet w-full">{copy.termsLink}</Link>
          <button type="button" disabled={busy} onClick={() => void signOut()} className="st-btn st-btn-forest w-full">
            {busy ? copy.signingOut : copy.signOut}
          </button>
        </div>
      </main>
      <StoryTabbar current="pet" {...storyTabProps(copy, petId, true)} />
    </div>
  );
}

function SettingsRow({ label, value, soon }: { label: string; value?: string; soon?: string }) {
  return (
    <li className="st-card flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      {soon ? <span className="rounded-full bg-[color:var(--st-beige)] px-2.5 py-1 text-xs">{soon}</span> : null}
      {value ? <span className="max-w-[50%] truncate text-right text-xs text-[color:var(--st-text-soft)]">{value}</span> : null}
    </li>
  );
}
