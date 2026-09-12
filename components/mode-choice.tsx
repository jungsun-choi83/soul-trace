"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { LETTER_MODES, letterModePath, modeCopy } from "@/lib/letter-mode";
import { PARTNER_CODE_PARAM } from "@/lib/partner";
import Image from "next/image";
import Link from "next/link";
import styles from "./mode-choice.module.css";

/**
 * 갈림길. 아이가 지금 곁에 있는지 먼저 묻는다.
 *
 * 설문을 다 채운 뒤에 묻는 편이 폼 하나로 끝나 간단하지만, 그러면 첫 화면부터
 * 마지막 질문까지의 문구를 어느 한쪽으로 정해 두어야 한다. 어느 쪽으로 정하든
 * 나머지 절반의 사람에게는 틀린 말이 된다. 그래서 맨 앞에서 가른다.
 *
 * ── 왜 partnerCode 를 props 로 받는가 ───────────────────────────────────────
 * 이 화면은 파트너 QR(`/?p=<code>`)의 **착지점**이다. 그런데 여기서 다음 화면으로
 * 가는 링크는 `/living`·`/memorial` 이라, 예전에는 그 순간 `?p=` 가 통째로
 * 사라졌다. 설문 화면(SoulTraceFlow)은 코드를 `window.location.search` 에서
 * 읽으므로, 코드가 없는 주소에 도착하면 귀속이 조용히 NULL 이 된다 —
 * QR 은 정상 동작하는 것처럼 보이고 정산만 비었다.
 *
 * 그래서 코드를 링크에 **다시 실어 준다.** 서버가 이미 검증한 값이므로 여기서는
 * 그대로 옮기기만 한다.
 */
export function ModeChoice({
  partnerCode,
  preservedQuery = "",
}: {
  partnerCode: string | null;
  preservedQuery?: string;
}) {
  const { lang, t, messages } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const destinationParams = new URLSearchParams(preservedQuery);
  if (partnerCode && !destinationParams.has(PARTNER_CODE_PARAM)) {
    destinationParams.set(PARTNER_CODE_PARAM, partnerCode);
  }
  const destinationQuery = destinationParams.toString();
  const querySuffix = destinationQuery ? `?${destinationQuery}` : "";
  const archiveParams = new URLSearchParams(destinationParams);
  archiveParams.set("from", "choose");
  const archiveHref = `/life-archive?${archiveParams.toString()}`;

  const hrefFor = (mode: (typeof LETTER_MODES)[number]) => {
    const path = letterModePath(mode);
    return `${path}${querySuffix}`;
  };

  return (
    <main className="min-h-[100svh] overflow-x-hidden bg-black text-[#F3EAD8]">
      <header className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-6 py-4 md:px-10 md:py-5">
        <Link
          href={`/${querySuffix}`}
          className={`inline-flex w-fit items-center gap-2 rounded-md text-sm text-[#E8D6B4] transition hover:text-[#FFF4DE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] sm:text-base ${bodyFont}`}
        >
          <span aria-hidden="true" className="text-xl leading-none">←</span>
          <span>{t("landing.navBack")}</span>
        </Link>

        <p className="font-display-en text-center text-xs tracking-[0.34em] text-[#E8D6B4] sm:text-sm">
          SOUL TRACE
        </p>

        <div className="justify-self-end">
          <LanguageToggle />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[460px] px-6 pb-5 pt-2 md:px-6 md:pb-7 md:pt-4">
        <h1
          className={`${styles.fadeUp} text-center text-[1.65rem] font-light leading-tight text-[#F8EAD1] sm:text-3xl md:text-[2rem] ${
            lang === "ko" ? "font-ko break-keep" : "font-display-en tracking-[0.015em]"
          }`}
        >
            {t("landing.prompt")}
        </h1>

        <div className="mt-5 grid grid-cols-1 gap-4 md:mt-6 md:gap-5">
          {LETTER_MODES.map((mode, index) => {
            const copy = modeCopy(messages, mode);
            const imageSrc = mode === "living"
              ? "/images/choice-living.jpg"
              : "/images/choice-memorial.jpg";
            return (
              <Link
                key={mode}
                href={hrefFor(mode)}
                className={`${styles.fadeUp} group relative block aspect-[1.65/1] w-full overflow-hidden rounded-[18px] border border-[#B78A42]/80 bg-[#17130E] shadow-[0_0_0_rgba(197,148,69,0)] transition duration-300 hover:scale-[1.01] hover:border-[#D5A653] hover:shadow-[0_0_28px_rgba(197,148,69,0.16)] focus-visible:scale-[1.01] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E2B45E] motion-reduce:transform-none motion-reduce:transition-none`}
                style={{ animationDelay: `${100 + index * 90}ms` }}
              >
                <Image
                  src={imageSrc}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="(max-width: 459px) calc(100vw - 48px), 412px"
                  className="object-cover object-center transition duration-500 group-hover:scale-[1.015] motion-reduce:transform-none motion-reduce:transition-none"
                />
                <span
                  className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,5,0.02)_28%,rgba(8,7,5,0.18)_52%,rgba(8,7,5,0.94)_100%)]"
                  aria-hidden="true"
                />

                <span className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-4 sm:p-5 md:p-6">
                  <span className="min-w-0 flex-1 pr-1">
                    <span
                      className={`block text-lg font-light leading-[1.18] text-[#FFF4DF] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-xl md:text-2xl ${bodyFont}`}
                    >
                      {copy.landingCta}
                    </span>
                    <span
                      className={`mt-1.5 block text-xs font-light leading-relaxed text-[#E9DCC5]/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:text-[13px] md:text-sm ${bodyFont}`}
                    >
                      {copy.landingHint}
                    </span>
                  </span>

                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#E0AD59] bg-black/25 text-xl text-[#E8B65F] transition group-hover:bg-[#B8893D]/20 sm:size-12 sm:text-2xl"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className={`${styles.fadeUp} mt-5 flex justify-end md:mt-6`} style={{ animationDelay: "300ms" }}>
          <Link
            href={archiveHref}
            className={`inline-flex min-h-11 items-center gap-2 border-b border-[#B78A42]/55 px-0.5 text-sm text-[#C9A45E]/85 transition hover:border-[#D5A653]/80 hover:text-[#D5A653] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] ${bodyFont}`}
          >
            <span>{t("lifeArchive.title")}</span>
            <span aria-hidden="true" className="text-base leading-none">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
