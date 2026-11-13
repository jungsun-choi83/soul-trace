"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { POSE_ART } from "@/lib/pose-art";
import Link from "next/link";

const COPY = {
  ko: {
    title: "우리아이 첫 폴라로이드 만들기",
    bodyLead: "사진 한 장과 이름이면 돼요.",
    bodyRest: "가입하기 전에 결과를 먼저 볼 수 있어요.",
    start: "비회원으로 만들어 보기",
    login: "이미 계정이 있어요 · 로그인",
    homes: "기록 홈으로",
  },
  en: {
    title: "Make your pet's first polaroid",
    bodyLead: "A photo and a name are enough.",
    bodyRest: "You can see the result before creating an account.",
    start: "Try it without an account",
    login: "I already have an account · Sign in",
    homes: "Open the memory home",
  },
} as const;

/** First visit: full-bleed spring pose on a phone viewport. No inset card. */
export function FreeTrialStart() {
  const { lang } = useLocale();
  const copy = COPY[lang === "en" ? "en" : "ko"];
  return (
    <main className={`relative h-[100svh] w-full overflow-hidden bg-[#1c2418] text-[#3a3428] ${lang === "ko" ? "break-keep" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={POSE_ART.shibaSpring}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[center_28%]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-[#fffaf1] via-[#fffaf1]/88 to-transparent" />
      <div className="relative z-[1] mx-auto flex h-full w-full max-w-[430px] flex-col px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-[max(0.35rem,env(safe-area-inset-top))]">
        <div className="flex justify-end">
          <LanguageToggle tone="paper" compact />
        </div>
        <div className="mt-auto pb-1">
          <h1 className="st-headline text-balance text-center text-[clamp(1.22rem,5.2vw,1.48rem)] leading-[1.28] !tracking-[-0.04em] text-[#2f3a28] drop-shadow-[0_1px_0_rgba(255,250,241,0.85)]">
            {copy.title}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[22rem] text-center text-[0.8125rem] leading-5 tracking-[-0.02em] text-[#5a4a3a]">
            <span className="block">{copy.bodyLead}</span>
            <span className="block">{copy.bodyRest}</span>
          </p>
          <div className="mt-3.5 grid gap-2.5">
            <Link href="/try" className="st-btn st-btn-forest w-full">
              {copy.start}
            </Link>
            <Link
              href="/auth?returnTo=%2Fdashboard&mode=signin"
              className="flex min-h-11 items-center justify-center rounded-full border border-[#e4d2b4] bg-[#fffdf8]/95 px-4 text-sm font-semibold text-[#5a3d27]"
            >
              {copy.login}
            </Link>
            <Link href="/choose" className="pb-0.5 text-center text-sm text-[#5a4a3a]">
              {copy.homes}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
