"use client";
import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";

export function HomepageFooter() {
  const { lang, t } = useLocale();
  const display = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  return <footer className="border-t border-white/10 bg-[#0b0a09] py-12 text-[#f8f2e7]"><div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-5 text-center sm:px-8 md:flex-row md:justify-between md:text-left"><div className="flex flex-col items-center gap-2 md:items-start"><div className="flex items-center gap-2.5"><span className="size-2 rounded-full bg-[#c8a24a] shadow-[0_0_12px_rgba(200,162,74,0.7)]" /><span className="font-display-en text-lg uppercase !tracking-[0.2em]">Soul Trace</span></div><p className={`${display} text-sm text-white/55`}>{t("homepage.footer.tagline")}</p></div><div className="flex flex-col items-center gap-4 md:items-end"><LanguageToggle /><p className="text-xs text-white/40">© {new Date().getFullYear()} Soul Trace. {t("homepage.footer.rights")}</p></div></div></footer>;
}
