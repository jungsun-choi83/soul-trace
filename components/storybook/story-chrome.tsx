"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { BrandMark } from "@/components/storybook/brand-mark";
import { useLocale } from "@/components/locale-provider";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Link from "next/link";
import type { ReactNode } from "react";

export function StoryBrandHeader({
  backHref,
  backLabel,
  onBack,
  settingsHref,
  settingsLabel,
  homeHref = "/dashboard",
}: {
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  settingsHref?: string;
  settingsLabel?: string;
  homeHref?: string;
}) {
  const { t } = useLocale();
  const back = onBack ? (
    <button type="button" onClick={onBack} aria-label={backLabel || t("landing.navBack")} className="inline-flex min-h-11 items-center text-lg text-[#594b3c]">
      ←
    </button>
  ) : backHref ? (
    <Link href={backHref} aria-label={backLabel || t("landing.navBack")} className="inline-flex min-h-11 items-center text-lg text-[#594b3c]">
      ←
    </Link>
  ) : (
    <span />
  );

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      {back}
      <Link href={homeHref} className="flex flex-col items-center text-[#6b4a2c]">
        <BrandMark className="h-8 w-8" />
        <span className="font-display-en text-lg !tracking-[0.04em]">SoulTrace</span>
      </Link>
      <div className="flex items-center justify-end gap-1">
        {settingsHref ? (
          <Link href={settingsHref} aria-label={settingsLabel || t("landing.navBack")} className="inline-flex size-11 items-center justify-center rounded-full text-[#6b4a2c]">
            <SettingsGearIcon />
          </Link>
        ) : null}
        <LanguageToggle tone="paper" />
      </div>
    </header>
  );
}

export function UiuxHero({
  src = UIUX_GARDEN_HERO,
  title,
  body,
  children,
}: {
  src?: string;
  title?: string;
  body?: string;
  children?: ReactNode;
}) {
  const pose = src.includes("/images/poses/");
  return (
    <section className="relative mt-4 overflow-hidden rounded-[22px] bg-[#f8f2e5]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`${pose ? "aspect-[3/4]" : "aspect-[16/9]"} w-full bg-[#f6efe2] object-contain object-center`} />
      {title || body || children ? (
        <div className="px-5 py-4 text-[#3a3428]">
          {title ? <h1 className="st-headline text-[1.7rem] leading-snug">{title}</h1> : null}
          {body ? <p className="mt-1 text-sm leading-6 text-[#6b5846]">{body}</p> : null}
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function SettingsGearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6" />
    </svg>
  );
}

export function StatusPill({ children, tone = "quiet" }: { children: ReactNode; tone?: "living" | "quiet" }) {
  return (
    <span className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs ${tone === "living" ? "bg-[#3a452f] text-[#fff5dc]" : "border border-[#d8c7a8] bg-[#fff8ec] text-[#5c4633]"}`}>
      {children}
    </span>
  );
}
