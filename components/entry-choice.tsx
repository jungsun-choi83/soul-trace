"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { EternalBeamLogo } from "@/components/storybook/eternal-beam-logo";
import { useLocale } from "@/components/locale-provider";
import { entryHomePath, writeEntryBranch, type EntryBranch } from "@/lib/entry-branch";
import { CLEAN_ART } from "@/lib/design-art";
import { UIUX_GARDEN_HERO } from "@/lib/uiux-art";
import Link from "next/link";

const COPY = {
  ko: {
    eyebrow: "SOULTRACE · FIRST CHOICE",
    question: "어떤 아이의 이야기를 시작할까요?",
    lead: "아이와 함께하는 지금, 또는 마음속에 간직한 추억.\n원하는 이야기를 선택하세요.",
    livingBadge: "함께 있는 아이",
    livingTitle: "지금 함께 있는 아이",
    livingBody: "오늘을 기록하고, 새 추억을 만들어요.",
    memorialBadge: "구름 위의 아이",
    memorialTitle: "구름 위에 있는 아이",
    memorialBody: "소중했던 순간을 오래 간직해요.",
    login: "이미 계정이 있어요 · 로그인",
    back: "뒤로",
  },
  en: {
    eyebrow: "SOULTRACE · FIRST CHOICE",
    question: "Which story should we start?",
    lead: "The days you share now, or the memories you keep.\nChoose the story you want.",
    livingBadge: "Here now",
    livingTitle: "A pet who's here now",
    livingBody: "Record today and make new memories.",
    memorialBadge: "Above the clouds",
    memorialTitle: "A pet above the clouds",
    memorialBody: "Keep the moments that mattered.",
    login: "I already have an account · Sign in",
    back: "Back",
  },
} as const;

export function EntryChoice({ petId = null }: { petId?: string | null }) {
  const { lang } = useLocale();
  const copy = COPY[lang === "en" ? "en" : "ko"];
  const body = lang === "ko" ? "break-keep" : "";

  const remember = (branch: EntryBranch) => {
    writeEntryBranch(window.sessionStorage, branch);
  };

  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip bg-[#fffaf1] text-[#3a3428] ${body}`}>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-5">
        <header className="grid h-14 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1">
          <Link href="/?splash=1" aria-label={copy.back} className="inline-flex size-11 items-center justify-center text-[#5a4636]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </Link>
          <span className="flex min-w-0 items-center justify-center gap-1.5 text-[#6b4a2c]">
            <EternalBeamLogo className="h-6 w-auto shrink-0" />
            <span className="truncate font-display-en text-[15px] !tracking-[0.04em]">SoulTrace</span>
          </span>
          <LanguageToggle tone="paper" compact />
        </header>

        <p className="mt-1 text-center text-[10px] font-semibold tracking-[0.08em] text-[#8a7358]">{copy.eyebrow}</p>
        <h1 className="st-headline mt-1.5 text-balance text-center text-[clamp(1.15rem,5.2vw,1.35rem)] leading-[1.35] !tracking-[-0.03em] text-[#2f3a28]">{copy.question}</h1>
        <p className="mx-auto mt-1.5 max-w-[22rem] whitespace-pre-line text-center text-[13px] leading-[1.45] tracking-[-0.01em] text-[#6b5846]">{copy.lead}</p>

        <div className="mt-4 grid w-full min-w-0 gap-3 [grid-template-columns:repeat(2,minmax(0,1fr))]">
          <ChoiceCard
            testId="living-choice"
            href={entryHomePath("living", petId)}
            onChoose={() => remember("living")}
            src={UIUX_GARDEN_HERO}
            badge={copy.livingBadge}
            title={copy.livingTitle}
            body={copy.livingBody}
            tone="spring"
          />
          <ChoiceCard
            testId="memorial-choice"
            href={entryHomePath("memorial", petId)}
            onChoose={() => remember("memorial")}
            src={CLEAN_ART.memorialHero}
            badge={copy.memorialBadge}
            title={copy.memorialTitle}
            body={copy.memorialBody}
            tone="sky"
          />
        </div>

        <div className="mt-auto pt-3">
          <Link href="/auth?returnTo=%2Fdashboard&mode=signin" className="flex min-h-12 w-full items-center justify-center rounded-full border border-[#e4d2b4] bg-[#fffdf8] px-4 text-center text-sm font-semibold text-[#5a3d27]">
            {copy.login}
          </Link>
        </div>
      </div>
    </main>
  );
}

function ChoiceCard({
  testId,
  href,
  onChoose,
  src,
  badge,
  title,
  body,
  tone,
}: {
  testId: string;
  href: string;
  onChoose: () => void;
  src: string;
  badge: string;
  title: string;
  body: string;
  tone: "spring" | "sky";
}) {
  return (
    <Link
      data-testid={testId}
      href={href}
      onClick={onChoose}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#e4d2b4] bg-[#fffdf8]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className={`block aspect-[1/1.05] w-full object-cover ${tone === "spring" ? "object-[center_42%]" : "object-[center_64%]"}`} />
      <span className="flex flex-1 flex-col px-2.5 pb-3 pt-2.5">
        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-[-0.01em] ${tone === "spring" ? "bg-[#e5f0e2] text-[#3f6b45]" : "bg-[#ece7f3] text-[#5c5478]"}`}>
          {badge}
        </span>
        <span className="st-headline mt-2 text-[13px] leading-[1.35] !tracking-[-0.03em] text-[#2f3a28]">{title}</span>
        <span className="mt-1 text-[12px] leading-[1.4] tracking-[-0.015em] text-[#6b5846]">{body}</span>
      </span>
    </Link>
  );
}
