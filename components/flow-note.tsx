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
  art,
  lifeStatus = "unspecified",
  tab = "home",
  signedIn = false,
  showTabs = true,
}: {
  title: string;
  body: string;
  links: { href: string; label: string }[];
  art?: string;
  lifeStatus?: LifeStatus;
  tab?: "home" | "memories" | "create" | "pet";
  signedIn?: boolean;
  showTabs?: boolean;
}) {
  const { lang } = useLocale();
  const copy = petFirstCopy(lang);
  return (
    <div className={`st-paper st-grain st-body flex min-h-[100svh] flex-col overflow-x-clip ${lang === "ko" ? "break-keep" : ""}`}>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-8 pt-8">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" className="mb-5 aspect-[4/3] w-full rounded-[22px] bg-[#f6efe2] object-contain object-center" />
        ) : null}
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
      {showTabs ? <StoryTabbar current={tab} {...storyTabProps(copy, null, signedIn, lifeStatus)} /> : null}
    </div>
  );
}
