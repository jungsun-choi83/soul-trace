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
    question: "어떤 아이의 이야기를 시작할까요?",
    livingTitle: "지금 함께 있는 아이",
    livingBody: "우리 아이의 오늘을 기록하고 추억을 쌓아요.",
    livingCta: "함께 있는 아이로 시작하기",
    memorialTitle: "구름 위에 있는 아이",
    memorialBody: "함께했던 소중한 순간을 오래 간직해요.",
    memorialCta: "구름 위의 아이로 시작하기",
    guest: "편지와 폴라로이드는 가입 전에 먼저 볼 수 있어요.",
    login: "계정이 있으면 로그인",
  },
  en: {
    question: "Which story should we start?",
    livingTitle: "A pet who's here now",
    livingBody: "Record today and keep the memories you make together.",
    livingCta: "Start with the pet who's here",
    memorialTitle: "A pet above the clouds",
    memorialBody: "Keep the moments you shared, for a long time.",
    memorialCta: "Start with the pet above the clouds",
    guest: "Letters and polaroids can be tried before you create an account.",
    login: "I already have an account",
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
      <div className="mx-auto flex w-full max-w-md flex-col px-5 pb-10 pt-[max(0.8rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[#6b4a2c]">
            <EternalBeamLogo className="h-8 w-auto" />
            <span className="font-display-en text-lg tracking-[0.06em]">SoulTrace</span>
          </span>
          <LanguageToggle tone="paper" />
        </div>

        <h1 className="st-headline mt-8 text-[1.65rem] leading-snug text-[#2f3a28]">{copy.question}</h1>

        <div className="mt-5 grid gap-4">
          <ChoiceCard
            href={entryHomePath("living", petId)}
            onChoose={() => remember("living")}
            src={UIUX_GARDEN_HERO}
            title={copy.livingTitle}
            body={copy.livingBody}
            cta={copy.livingCta}
            tone="spring"
          />
          <ChoiceCard
            href={entryHomePath("memorial", petId)}
            onChoose={() => remember("memorial")}
            src={CLEAN_ART.memorialHero}
            title={copy.memorialTitle}
            body={copy.memorialBody}
            cta={copy.memorialCta}
            tone="sky"
          />
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-[#6b5846]">{copy.guest}</p>
        <Link href="/auth?returnTo=%2Fdashboard" className="mt-2 text-center text-sm font-semibold text-[#5a3d27] underline-offset-4 hover:underline">
          {copy.login}
        </Link>
      </div>
    </main>
  );
}

function ChoiceCard({
  href,
  onChoose,
  src,
  title,
  body,
  cta,
  tone,
}: {
  href: string;
  onChoose: () => void;
  src: string;
  title: string;
  body: string;
  cta: string;
  tone: "spring" | "sky";
}) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-[#e4d2b4] bg-[#fffdf8] shadow-[0_16px_32px_-22px_rgba(70,48,33,0.45)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`w-full object-contain object-center ${tone === "spring" ? "aspect-[941/1036]" : "aspect-[1086/1448]"}`}
      />
      <div className="px-4 pb-4 pt-3">
        <h2 className="st-headline text-[1.25rem] text-[#2f3a28]">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[#6b5846]">{body}</p>
        <Link
          href={href}
          onClick={onChoose}
          className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-full px-4 text-center text-[0.95rem] font-semibold ${
            tone === "spring" ? "bg-[#3f6b45] text-[#fffaf1]" : "bg-[#5c6f86] text-[#fffaf1]"
          }`}
        >
          {cta}
        </Link>
      </div>
    </article>
  );
}
