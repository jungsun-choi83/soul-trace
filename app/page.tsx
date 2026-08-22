"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { WarmRisingSparkles } from "@/components/warm-rising-sparkles";
import { LETTER_MODES, letterModePath, modeCopy } from "@/lib/letter-mode";
import Link from "next/link";

/**
 * 갈림길. 아이가 지금 곁에 있는지 먼저 묻는다.
 *
 * 설문을 다 채운 뒤에 묻는 편이 폼 하나로 끝나 간단하지만, 그러면 첫 화면부터
 * 마지막 질문까지의 문구를 어느 한쪽으로 정해 두어야 한다. 어느 쪽으로 정하든
 * 나머지 절반의 사람에게는 틀린 말이 된다. 그래서 맨 앞에서 가른다.
 */
export default function ModeChoicePage() {
  const { lang, t, messages } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  return (
    <main className="relative isolate flex min-h-screen flex-col bg-black">
      <WarmRisingSparkles />
      <header className="relative z-[2] flex w-full shrink-0 justify-end px-5 pt-6 md:px-8 md:pt-8">
        <LanguageToggle />
      </header>

      <div className="relative z-[2] flex flex-1 items-center justify-center px-5 pb-16 pt-2 md:px-8">
        <section className="animate-fade-in w-full max-w-xl text-center">
          <p className="font-display-en text-xs uppercase tracking-[0.35em] text-[#D4AF37]">
            {t("hero.eyebrow")}
          </p>
          <h1 className="font-display-en mt-6 text-4xl text-[#FFFFFF] md:text-5xl">
            {t("hero.title")}
          </h1>
          <p
            className={`mx-auto mt-7 max-w-lg whitespace-pre-line text-[#F3EAD8]/[0.94] ${
              lang === "ko"
                ? "font-ko break-keep text-[15px] font-extralight leading-[2.05] tracking-[0.055em] sm:text-base"
                : "font-display-en text-sm font-extralight leading-[2.05] tracking-[0.2em] sm:text-base"
            }`}
          >
            {t("hero.subtitleLine1")}
          </p>

          <p
            className={`mt-12 text-xs font-extralight tracking-[0.18em] text-[#D4AF37]/85 sm:text-sm ${bodyFont}`}
          >
            {t("landing.prompt")}
          </p>

          <div className="mt-6 space-y-3">
            {LETTER_MODES.map((mode, index) => {
              const copy = modeCopy(messages, mode);
              const primary = index === 0;
              return (
                <Link
                  key={mode}
                  href={letterModePath(mode)}
                  className={`block rounded-2xl px-5 py-4 transition ${bodyFont} ${
                    primary
                      ? "bg-[#c8ab55] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-[#b89a2e]"
                      : "border border-[rgba(212,175,55,0.45)] bg-[rgba(12,11,10,0.6)] text-[#F3EAD8] hover:border-[rgba(212,175,55,0.7)] hover:bg-[rgba(24,20,14,0.7)]"
                  }`}
                >
                  <span className="block text-base font-light leading-snug sm:text-lg">
                    {copy.landingCta}
                  </span>
                  <span
                    className={`mt-1.5 block text-xs font-extralight leading-relaxed sm:text-[13px] ${
                      primary ? "text-black/62" : "text-[#C4B8A8]"
                    }`}
                  >
                    {copy.landingHint}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
