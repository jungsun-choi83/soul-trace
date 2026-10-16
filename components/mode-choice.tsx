"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { letterModePath, modeCopy, type LetterMode } from "@/lib/letter-mode";
import { PARTNER_CODE_PARAM } from "@/lib/partner";
import Image from "next/image";
import Link from "next/link";
import styles from "./mode-choice.module.css";

type CardKind = LetterMode | "polaroid";

type ChoiceCardProps = {
  kind: CardKind;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  imageSrc: string;
  imageAlt: string;
  imageLabel?: string;
  bodyFont: string;
  priority?: boolean;
  seasonal?: boolean;
};

function PawMark() {
  return (
    <svg aria-hidden="true" className="size-5 fill-[#F0C65A]" viewBox="0 0 32 28">
      <ellipse cx="16" cy="18" rx="7" ry="8" />
      <ellipse cx="6.5" cy="10" rx="3.2" ry="4.5" transform="rotate(-25 6.5 10)" />
      <ellipse cx="13" cy="5" rx="3.2" ry="4.5" transform="rotate(-8 13 5)" />
      <ellipse cx="20" cy="5" rx="3.2" ry="4.5" transform="rotate(8 20 5)" />
      <ellipse cx="25.5" cy="10" rx="3.2" ry="4.5" transform="rotate(25 25.5 10)" />
    </svg>
  );
}

function CardDecoration({ kind }: { kind: CardKind }) {
  if (kind === "living") {
    return (
      <svg aria-hidden="true" className={styles.cardDecoration} viewBox="0 0 72 56" fill="none">
        <path d="M8 12 35 5l28 8-28 8L8 12Z" />
        <path d="M8 12v28l27 11 28-11V13M8 40l27 11 28-11" />
        <path d="m35 21 9 9c-3 5-9 7-9 7s-6-2-9-7l9-9Z" />
      </svg>
    );
  }
  if (kind === "memorial") {
    return (
      <svg aria-hidden="true" className={styles.cardDecoration} viewBox="0 0 72 56" fill="none">
        <path d="M36 48S7 32 7 17C7 7 19 5 25 13c6-8 18-6 18 4 0-10 12-12 18-4 6 15-25 35-25 35Z" />
        <path d="M53 7v10M48 12h10M63 35v8M59 39h8" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className={styles.cardDecoration} viewBox="0 0 72 56" fill="none">
      <path d="M12 28c5-7 11-10 18-10 7 0 13 3 18 10-5 7-11 10-18 10-7 0-13-3-18-10Z" />
      <path d="M30 18c-1-5 1-9 5-12M48 18c1-5 4-7 8-8M20 39c-2 4-1 8 2 11M53 38c3 3 4 6 3 10" />
      <path d="m37 10 3 3-3 3-3-3 3-3Z" />
    </svg>
  );
}

function ChoiceCard({
  kind,
  href,
  eyebrow,
  title,
  description,
  cta,
  imageSrc,
  imageAlt,
  imageLabel,
  bodyFont,
  priority = false,
  seasonal = false,
}: ChoiceCardProps) {
  return (
    <Link
      href={href}
      className={`${styles.card} ${styles.fadeUp} group`}
      style={{ animationDelay: `${kind === "living" ? 100 : kind === "memorial" ? 180 : 260}ms` }}
    >
      <div className={`${styles.cardImage} ${seasonal ? styles.seasonalImage : ""}`}>
        {seasonal ? (
          <div className={styles.seasonalFrame}>
            <div className="relative aspect-[1.35/1] overflow-hidden bg-[#2B1813]">
              <Image
                src={imageSrc}
                alt={imageAlt}
                fill
                priority={priority}
                sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1279px) 46vw, 30vw"
                className="object-cover object-[center_32%] transition duration-500 group-hover:scale-[1.04]"
              />
              <span className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,178,76,0.35),transparent_24%),linear-gradient(145deg,rgba(38,15,42,0.22),rgba(119,49,22,0.35))]" aria-hidden="true" />
            <span className={`absolute left-3 top-3 rounded-full border border-[#F5C66A]/80 bg-[#1A0E0B]/80 px-2.5 py-1 text-[9px] uppercase tracking-[0.2em] text-[#FFE09A] sm:left-4 sm:top-4 ${langFont(bodyFont)}`}>
                {imageLabel}
              </span>
            </div>
            <span className="absolute -bottom-2 -right-2 text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]" aria-hidden="true">🎃</span>
            <span className="absolute -bottom-2 right-8 text-2xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]" aria-hidden="true">👻</span>
          </div>
        ) : (
          <>
            <Image
              src={imageSrc}
              alt={imageAlt}
              fill
              priority={priority}
              sizes="(max-width: 767px) calc(100vw - 48px), (max-width: 1279px) 46vw, 30vw"
              className="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,5,0.04)_20%,rgba(8,7,5,0.14)_48%,rgba(8,7,5,0.66)_100%)]" aria-hidden="true" />
            <span className={`absolute inset-x-4 top-4 max-w-[78%] text-left text-lg leading-[1.12] tracking-[0.12em] text-[#FFF4DF] drop-shadow-[0_2px_10px_rgba(0,0,0,0.88)] sm:inset-x-6 sm:top-6 sm:text-xl ${langFont(bodyFont)}`}>
              {imageLabel}
            </span>
          </>
        )}
      </div>

      <div className={`${styles.cardBody} ${bodyFont}`}>
        <p className={`text-[10px] uppercase tracking-[0.3em] text-[#E4B84D] sm:text-[11px] ${langFont(bodyFont)}`}>
          {eyebrow}
        </p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h2 className={`${langFont(bodyFont)} ${bodyFont.includes("font-ko") ? "break-keep" : "whitespace-nowrap"} text-[1.2rem] font-light leading-tight tracking-[0.04em] text-[#FFF2D7] sm:text-[1.4rem]`}>
            {title}
          </h2>
          <CardDecoration kind={kind} />
        </div>
        <p className={`mt-3 max-w-[34ch] text-xs leading-6 text-[#E9DCC5]/85 sm:text-sm sm:leading-6 ${langFont(bodyFont)}`}>
          {description}
        </p>
        <span className={`mt-auto flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#F1C75B] px-5 pt-0.5 text-center text-[15px] tracking-[0.13em] text-[#22170C] shadow-[0_8px_24px_rgba(241,199,91,0.14)] transition duration-300 group-hover:bg-[#FFD978] group-hover:shadow-[0_10px_30px_rgba(241,199,91,0.24)] ${langFont(bodyFont)}`}>
          {cta}
          <span className="text-xl leading-none" aria-hidden="true">→</span>
        </span>
      </div>
    </Link>
  );
}

function langFont(bodyFont: string): string {
  return bodyFont.includes("font-ko") ? "font-ko break-keep" : "font-display-en";
}

export function ModeChoice({
  partnerCode,
  preservedQuery = "",
}: {
  partnerCode: string | null;
  preservedQuery?: string;
}) {
  const { lang, t, messages } = useLocale();
  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const destinationParams = new URLSearchParams(preservedQuery);

  if (partnerCode && !destinationParams.has(PARTNER_CODE_PARAM)) {
    destinationParams.set(PARTNER_CODE_PARAM, partnerCode);
  }

  const destinationQuery = destinationParams.toString();
  const querySuffix = destinationQuery ? `?${destinationQuery}` : "";
  const hrefFor = (mode: LetterMode) => `${letterModePath(mode)}${querySuffix}`;
  const polaroidHref = `/polaroid${querySuffix}`;
  const livingCopy = modeCopy(messages, "living");
  const memorialCopy = modeCopy(messages, "memorial");

  return (
    <main className={`${styles.page} min-h-[100svh] overflow-x-hidden text-[#F3EAD8]`}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.branch} aria-hidden="true" />

      <header className="relative z-10 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-5 sm:px-8 md:px-10 md:py-7">
        <Link
          href={`/${querySuffix}`}
          className={`inline-flex w-fit items-center gap-2 rounded-md text-sm text-[#E8D6B4] transition hover:text-[#FFF4DE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] sm:text-base ${bodyFont}`}
        >
          <span aria-hidden="true" className="text-xl leading-none">←</span>
          <span>{t("landing.navBack")}</span>
        </Link>

        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <span className={styles.brandRule} aria-hidden="true" />
          <div className="flex flex-col items-center gap-1">
            <span className="font-display-en text-[10px] uppercase tracking-[0.45em] text-[#EAC15A] sm:text-xs">SOUL TRACE</span>
            <PawMark />
          </div>
          <span className={styles.brandRule} aria-hidden="true" />
        </div>

        <div className="flex items-center justify-self-end gap-3 sm:gap-5">
          <Link
            href="/my-polaroids"
            className={`inline-flex rounded-md text-[10px] text-[#E8D6B4] transition hover:text-[#FFF4DE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] sm:text-xs ${bodyFont}`}
          >
            {t("landing.myPolaroids")}
          </Link>
          <LanguageToggle />
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-[1480px] px-5 pb-14 pt-7 sm:px-8 sm:pt-10 md:pb-20 lg:px-10 lg:pt-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1
            className={`${styles.fadeUp} text-[1.65rem] font-light leading-tight text-[#FFF0D0] sm:text-3xl md:text-[3rem] ${lang === "ko" ? "font-ko break-keep" : "font-display-en tracking-[-0.015em]"}`}
          >
            {t("landing.prompt")}
          </h1>
          <p className={`${styles.fadeUp} mt-3 text-xs leading-6 text-[#E7D7BD]/90 sm:text-sm sm:leading-7 ${lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal"}`} style={{ animationDelay: "80ms" }}>
            {t("landing.subtitle")}
          </p>
        </div>

        <div className={`${styles.choiceGrid} mt-11 md:mt-14`}>
          <ChoiceCard
            kind="living"
            href={hrefFor("living")}
            eyebrow={t("landing.livingEyebrow")}
            title={t("landing.livingTitle")}
            description={t("landing.livingDescription")}
            cta={t("landing.letterCta")}
            imageSrc="/images/choice-living.jpg"
            imageAlt=""
            imageLabel={livingCopy.landingCta}
            bodyFont={bodyFont}
            priority
          />
          <ChoiceCard
            kind="memorial"
            href={hrefFor("memorial")}
            eyebrow={t("landing.memorialEyebrow")}
            title={t("landing.memorialTitle")}
            description={t("landing.memorialDescription")}
            cta={t("landing.letterCta")}
            imageSrc="/images/choice-memorial.jpg"
            imageAlt=""
            imageLabel={memorialCopy.landingCta}
            bodyFont={bodyFont}
          />
          <ChoiceCard
            kind="polaroid"
            href={polaroidHref}
            eyebrow={t("landing.polaroidCardEyebrow")}
            title={t("landing.polaroidTitle")}
            description={t("landing.polaroidCardDescription")}
            cta={t("landing.polaroidCta")}
            imageSrc="/images/Cozy Halloween Night Polaroid.png"
            imageAlt={t("landing.polaroidPreviewAlt")}
            imageLabel={t("landing.polaroidEyebrow")}
            bodyFont={bodyFont}
            seasonal
          />
        </div>
      </section>
    </main>
  );
}
