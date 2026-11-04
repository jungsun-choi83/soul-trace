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
    lead: "아이와 함께하는 지금, 또는 마음속에 간직한 추억. 원하는 이야기를 선택하세요.",
    livingBadge: "함께 있는 아이",
    livingTitle: "지금 함께 있는 아이",
    livingBody: "오늘을 기록하고, 새 추억을 만들어요.",
    memorialBadge: "구름 위의 아이",
    memorialTitle: "구름 위에 있는 아이",
    memorialBody: "소중했던 순간을 오래 간직해요.",
    note: "선택 후 각각 다른 홈으로 이동합니다. 첫 선택은 체험 상태이며, 아이의 공식 프로필 상태는 직접 등록할 때 확정합니다.",
    login: "이미 계정이 있어요 · 로그인",
    back: "뒤로",
  },
  en: {
    eyebrow: "SOULTRACE · FIRST CHOICE",
    question: "Which story should we start?",
    lead: "The days you share now, or the memories you keep. Choose the story you want.",
    livingBadge: "Here now",
    livingTitle: "A pet who's here now",
    livingBody: "Record today and make new memories.",
    memorialBadge: "Above the clouds",
    memorialTitle: "A pet above the clouds",
    memorialBody: "Keep the moments that mattered.",
    note: "Each choice opens a different home. This first look stays temporary until you save the pet's profile.",
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
    <main className={`min-h-[100svh] overflow-x-clip bg-[#fffaf1] text-[#3a3428] ${body}`}>
      <div className="mx-auto w-full max-w-[430px] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] sm:px-5">
        <header className="grid h-14 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-1">
          <Link href="/?splash=1" aria-label={copy.back} className="inline-flex size-11 items-center justify-center text-[#5a4636]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5 8 12l7 7" />
            </svg>
          </Link>
          <span className="flex min-w-0 items-center justify-center gap-1.5 text-[#6b4a2c]">
            <EternalBeamLogo className="h-6 w-auto shrink-0" />
            <span className="truncate font-display-en text-[14px] tracking-[0.02em]">SoulTrace</span>
          </span>
          <LanguageToggle tone="paper" compact />
        </header>

        <p className="mt-1 text-center text-[10px] font-semibold tracking-[0.14em] text-[#8a7358]">{copy.eyebrow}</p>
        <h1 className="st-headline mt-1.5 text-center text-[1.35rem] leading-snug text-[#2f3a28]">{copy.question}</h1>
        <p className="mx-auto mt-1.5 max-w-[22rem] text-center text-[13px] leading-5 text-[#6b5846]">{copy.lead}</p>

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

        <p className="mt-4 rounded-[16px] bg-[#f3ecdf] px-3.5 py-3 text-center text-[12px] leading-5 text-[#6b5846]">{copy.note}</p>
        <Link href="/auth?returnTo=%2Fdashboard" className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-[#e4d2b4] bg-[#fffdf8] px-4 text-center text-sm font-semibold text-[#5a3d27]">
          {copy.login}
        </Link>
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
      <img src={src} alt="" className="block aspect-[1/1.05] w-full object-cover object-center" />
      <span className="flex flex-1 flex-col px-2.5 pb-3 pt-2.5">
        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone === "spring" ? "bg-[#e5f0e2] text-[#3f6b45]" : "bg-[#ece7f3] text-[#5c5478]"}`}>
          {badge}
        </span>
        <span className="st-headline mt-2 text-[13px] leading-snug text-[#2f3a28]">{title}</span>
        <span className="mt-1 text-[12px] leading-4 text-[#6b5846]">{body}</span>
      </span>
    </Link>
  );
}
