"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";

const linkClassName = "transition-colors hover:text-[#d4af37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a09]";

export function HomepageFooter() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";

  return (
    <footer className="border-t border-white/10 bg-[#0b0a09] py-12 text-[#f8f2e7]">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-5 text-center sm:px-8 md:grid-cols-3 md:text-left">
        <div className="flex flex-col items-center gap-2 md:items-start">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-[#c8a24a] shadow-[0_0_12px_rgba(200,162,74,0.7)]" />
            <span className="font-display-en text-lg uppercase !tracking-[0.2em]">Soul Trace</span>
          </div>
          <p className={`${display} text-sm text-white/55`}>{t("homepage.footer.tagline")}</p>
        </div>
        <nav aria-label={t("homepage.footer.linksLabel")} className={`${display} flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-white/60 md:justify-center`}>
          <a href="/privacy-policy" className={linkClassName}>{t("homepage.footer.privacyPolicy")}</a>
          <a href="/terms-of-service" className={linkClassName}>{t("homepage.footer.termsOfService")}</a>
          <a href="mailto:hello@eternalbeamapp.com" className={linkClassName}>{t("homepage.footer.contact")}</a>
        </nav>
        <div className="flex flex-col items-center gap-4 md:items-end">
          <LanguageToggle />
          <p className="text-xs text-white/40">© {new Date().getFullYear()} Soul Trace. {t("homepage.footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}
