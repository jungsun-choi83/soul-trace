"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import {
  getEternalBeamFacebookUrl,
  getEternalBeamInstagramUrl,
  getEternalBeamYoutubeUrl,
} from "@/lib/eternalbeam-urls";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa6";

const linkClassName =
  "transition-colors hover:text-[#d4af37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a09]";

export function HomepageFooter() {
  const { lang, t } = useLocale();
  const display =
    lang === "ko"
      ? "font-ko break-keep"
      : "font-display-en !tracking-normal";
  const socialLinkClass =
    "flex size-8 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-[#d4af37] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4af37] motion-reduce:transform-none";

  return (
    <footer className="border-t border-white/10 bg-[#0b0a09] py-4 text-[#f8f2e7] md:py-6">
      <div className="mx-auto grid max-w-7xl grid-cols-2 items-center gap-x-4 gap-y-2 px-4 sm:gap-y-3 sm:px-8 md:flex md:justify-between md:gap-6">
        <div className="min-w-0 md:order-1">
          <div className="flex items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-full bg-[#c8a24a] shadow-[0_0_12px_rgba(200,162,74,0.7)]" />
            <div className="min-w-0">
              <span className="font-display-en block whitespace-nowrap text-sm uppercase !tracking-[0.2em] sm:text-base">
                Soul Trace
              </span>
              <p className={`${display} hidden text-[0.6rem] text-white/45 sm:block`}>
                {t("homepage.footer.tagline")}
              </p>
            </div>
          </div>
        </div>

        <div className="justify-self-end md:order-3">
          <LanguageToggle />
        </div>

        <div className="contents md:order-2 md:flex md:items-center md:gap-4">
          <nav
            aria-label={t("homepage.footer.linksLabel")}
            className={`${display} col-span-2 flex min-w-0 flex-wrap items-center justify-start gap-x-3 gap-y-1 text-xs text-white/60 sm:justify-center sm:gap-x-4 md:col-auto`}
          >
            <a href="/privacy-policy" className={linkClassName}>
              {t("homepage.footer.privacyPolicy")}
            </a>
            <a href="/terms-of-service" className={linkClassName}>
              {t("homepage.footer.termsOfService")}
            </a>
            <a href="mailto:hello@eternalbeamapp.com" className={linkClassName}>
              {t("homepage.footer.contact")}
            </a>
          </nav>

          <div className="col-span-2 flex items-center gap-2 md:col-auto md:gap-1">
            <a
              href={getEternalBeamInstagramUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Eternal Beam on Instagram"
              className={socialLinkClass}
            >
              <FaInstagram aria-hidden="true" className="size-[18px]" />
            </a>
            <a
              href={getEternalBeamFacebookUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Eternal Beam on Facebook"
              className={socialLinkClass}
            >
              <FaFacebookF aria-hidden="true" className="size-4" />
            </a>
            <a
              href={getEternalBeamYoutubeUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Eternal Beam on YouTube"
              className={socialLinkClass}
            >
              <FaYoutube aria-hidden="true" className="size-[18px]" />
            </a>
          </div>
        </div>

        <p className="col-span-2 justify-self-center whitespace-nowrap text-[0.6rem] text-white/40 sm:text-xs md:order-4 md:col-auto md:justify-self-end">
          © 2026 Soul Trace. {t("homepage.footer.rights")}
        </p>
      </div>
    </footer>
  );
}
