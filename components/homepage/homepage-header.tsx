"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getEternalBeamMainUrl } from "@/lib/eternalbeam-urls";
import { CloseIcon, MenuIcon } from "./icons";

const KICKSTARTER_URL = process.env.NEXT_PUBLIC_KICKSTARTER_URL?.trim() || null;
const SHOP_URL = getEternalBeamMainUrl();

function KickstarterNavLink({ mobile = false }: { mobile?: boolean }) {
  const className = mobile
    ? "mt-5 flex min-h-14 items-center justify-center gap-3 rounded-xl border border-[#05CE78]/55 bg-[#05CE78]/10 px-5 py-4 text-center text-base font-medium text-[#19E589] transition hover:border-[#19E589] hover:bg-[#05CE78]/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#19E589]"
    : "ml-2 inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full border border-[#05CE78]/50 bg-[#05CE78]/10 px-4 py-2 text-xs font-medium text-[#19E589] transition hover:border-[#19E589] hover:bg-[#05CE78]/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#19E589]";
  const content = <><span aria-hidden="true" className="shrink-0 text-base leading-none">🚀</span><span>Coming soon on Kickstarter</span></>;

  return KICKSTARTER_URL ? (
    <a href={KICKSTARTER_URL} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <button type="button" className={`${className} cursor-pointer`}>
      {content}
    </button>
  );
}

export function HomepageHeader({ choiceHref }: { choiceHref: string }) {
  const { lang, t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const displayFont = lang === "ko" ? "font-ko break-keep" : "font-display-en !tracking-normal";
  const links = [
    [t("homepage.nav.howItWorks"), "#how-it-works"],
    [t("homepage.nav.eternalBeam"), "#eternal-beam"],
    [t("homepage.nav.about"), "#about"],
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-500 ${scrolled ? "border-[#f8f2e7]/10 bg-[#0b0a09]/85 backdrop-blur-md" : "border-transparent bg-transparent"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 md:h-20">
        <a href="#top" className="flex min-w-0 items-center gap-2.5" aria-label={t("homepage.accessibility.home")}>
          <span className="size-2 shrink-0 rounded-full bg-[#c8a24a] shadow-[0_0_12px_rgba(200,162,74,0.7)]" aria-hidden="true" />
          <span className="font-display-en truncate text-lg uppercase !tracking-[0.2em] text-[#f8f2e7] md:text-xl">Soul Trace</span>
        </a>
        <nav className="hidden items-center gap-7 md:flex" aria-label={t("homepage.accessibility.primaryNav")}>
          {links.map(([label, href]) => <a key={href} href={href} className={`text-sm text-[#f8f2e7]/70 transition-colors hover:text-[#f8f2e7] ${displayFont}`}>{label}</a>)}
          <KickstarterNavLink />
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <LanguageToggle />
          <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" className={`rounded-full border border-[#c8a24a]/55 px-5 py-2.5 text-sm font-medium text-[#f8f2e7] transition hover:border-[#d8b463] hover:bg-[#c8a24a]/10 ${displayFont}`}>{t("homepage.nav.shop")}</a>
          <Link href={choiceHref} className={`rounded-full bg-[#c8a24a] px-5 py-2.5 text-sm font-medium text-[#0b0a09] transition hover:bg-[#d8b463] ${displayFont}`}>{t("homepage.nav.createLetter")}</Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
          <button type="button" onClick={() => setOpen(true)} aria-label={t("homepage.nav.menu")} aria-expanded={open} className="grid size-11 place-items-center rounded-full text-[#f8f2e7] hover:bg-white/10"><MenuIcon className="size-5" /></button>
        </div>
      </div>
      <div className={`fixed inset-0 z-[60] bg-[#0b0a09]/98 backdrop-blur-lg transition-opacity duration-300 md:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} aria-hidden={!open}>
        <div className="flex h-16 items-center justify-between px-5">
          <span className="font-display-en text-lg uppercase !tracking-[0.2em]">Soul Trace</span>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("homepage.nav.close")} className="grid size-11 place-items-center rounded-full hover:bg-white/10"><CloseIcon className="size-5" /></button>
        </div>
        <nav className="flex flex-col gap-1 px-6 pt-8" aria-label={t("homepage.accessibility.mobileNav")}>
          {links.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)} className={`border-b border-white/10 py-5 text-3xl text-[#f8f2e7]/90 hover:text-[#c8a24a] ${displayFont}`}>{label}</a>)}
          <KickstarterNavLink mobile />
          <a href={SHOP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={`mt-3 rounded-xl border border-[#c8a24a]/55 px-6 py-4 text-center text-base font-medium text-[#f8f2e7] transition hover:border-[#d8b463] hover:bg-[#c8a24a]/10 ${displayFont}`}>{t("homepage.nav.shop")}</a>
          <Link href={choiceHref} onClick={() => setOpen(false)} className={`mt-8 rounded-full bg-[#c8a24a] px-6 py-4 text-center text-base font-medium text-[#0b0a09] ${displayFont}`}>{t("homepage.nav.createLetter")}</Link>
        </nav>
      </div>
    </header>
  );
}
