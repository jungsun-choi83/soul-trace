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

export function FreeTrialStart() {
  const { lang } = useLocale();
  const copy = COPY[lang === "en" ? "en" : "ko"];
  return (
    <main className={`flex min-h-[100svh] flex-col overflow-x-clip bg-[#fffaf1] text-[#3a3428] ${lang === "ko" ? "break-keep" : ""}`}>
      <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
        <div className="flex justify-end pt-1">
          <LanguageToggle tone="paper" compact />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={POSE_ART.shibaSpring} alt="" className="mt-2 max-h-[min(52svh,28rem)] w-full rounded-[22px] bg-[#f6efe2] object-contain object-center" />
        <h1 className="st-headline mt-4 text-balance text-center text-[clamp(1.28rem,5.4vw,1.5rem)] leading-[1.35] !tracking-[-0.04em] text-[#2f3a28]">{copy.title}</h1>
        <p className="mx-auto mt-2 max-w-[22rem] text-center text-sm leading-6 tracking-[-0.02em] text-[#6b5846]">
          <span className="block">{copy.bodyLead}</span>
          <span className="block">{copy.bodyRest}</span>
        </p>
        <div className="mt-auto grid gap-3 pt-6">
          <Link href="/try" className="st-btn st-btn-forest w-full">{copy.start}</Link>
          <Link href="/auth?returnTo=%2Fdashboard&mode=signin" className="flex min-h-12 items-center justify-center rounded-full border border-[#e4d2b4] bg-[#fffdf8] px-4 text-sm font-semibold text-[#5a3d27]">{copy.login}</Link>
          <Link href="/choose" className="pb-2 text-center text-sm text-[#6b5846]">{copy.homes}</Link>
        </div>
      </div>
    </main>
  );
}
