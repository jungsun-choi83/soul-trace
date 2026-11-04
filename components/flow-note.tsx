"use client";

import { StoryTabbar } from "@/components/storybook/story-tabbar";
import { useLocale } from "@/components/locale-provider";
import { petFirstCopy } from "@/lib/storybook-copy";
import { storyTabProps } from "@/lib/story-tabs";
import type { LifeStatus } from "@/lib/pet-first-archive";
import Link from "next/link";

export function FlowNote({
  title,
  body,
  links,
  lifeStatus = "unspecified",
  tab = "home",
  signedIn = false,
}: {
  title: string;
  body: string;
  links: { href: string; label: string }[];
  lifeStatus?: LifeStatus;
  tab?: "home" | "memories" | "create" | "context" | "pet";
  signedIn?: boolean;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-8 pt-8">
        <h1 className="st-headline text-[1.7rem] leading-snug text-[#2f3a28]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6b5846]">{body}</p>
        <div className="mt-6 grid gap-3">
          {links.map((link) => (
            <Link key={`${link.href}-${link.label}`} href={link.href} className="st-btn st-btn-primary w-full">
              {link.label}
            </Link>
          ))}
        </div>
      </main>
      <StoryTabbar current={tab} {...storyTabProps(copy, null, signedIn, lifeStatus)} />
    </div>
  );
}
