"use client";

import { useLocale } from "@/components/locale-provider";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";

const KICKSTARTER_URL = process.env.NEXT_PUBLIC_KICKSTARTER_URL?.trim() || null;

export function KickstarterPromo({ fullBleed = false, compact = false }: { fullBleed?: boolean; compact?: boolean }) {
  const { lang, t } = useLocale();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [pageNotice, setPageNotice] = useState(false);

  useEffect(() => {
    if (!dialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dialogOpen]);

  const openDialog = () => {
    setStatus("idle");
    setDialogOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    try {
      const response = await fetch("/api/kickstarter-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale: lang }),
      });
      if (!response.ok) throw new Error("Unable to join waitlist");
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section
      aria-label="Eternal Beam Kickstarter"
      className={`${fullBleed ? "w-screen [margin-inline:calc(50%_-_50vw)]" : ""} bg-[#0b0a09] ${compact ? "pb-0" : "pb-2 md:pb-4"}`}
    >
      <div className="w-full">
        <div className="bg-black py-2 md:hidden">
          <div className="relative aspect-[5/6] w-full overflow-hidden bg-black">
            <Image
              src={lang === "ko" ? "/images/kickstarter-mobile-ko.png" : "/images/kickstarter mobile.png"}
              alt={lang === "ko" ? "Eternal Beam Kickstarter 출시 안내" : "Eternal Beam coming soon on Kickstarter"}
              fill
              sizes="(max-width: 767px) calc(100vw - 24px), 448px"
              className="object-cover object-top"
            />
            <button
              type="button"
              onClick={openDialog}
              aria-label={t("homepage.kickstarter.notify")}
              className="absolute left-[15%] top-[78.4%] min-h-12 w-[70%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
            />
            {KICKSTARTER_URL ? (
              <a
                href={KICKSTARTER_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("homepage.kickstarter.visit")}
                className="absolute left-[15%] top-[88.9%] min-h-12 w-[70%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPageNotice(true)}
                aria-label={t("homepage.kickstarter.visit")}
                className="absolute left-[15%] top-[88.9%] min-h-12 w-[70%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
              />
            )}
          </div>
        </div>

        <div className="relative hidden aspect-[1916/821] w-full overflow-hidden bg-black md:block">
          <Image
            src={lang === "ko" ? "/images/comingsoon-ko-small.png" : "/images/comingsoon-small.png"}
            alt={lang === "ko" ? "Eternal Beam Kickstarter 출시 안내" : "Eternal Beam Kickstarter launch announcement"}
            width={1916}
            height={821}
            sizes="100vw"
            className="absolute inset-x-0 top-0 h-auto w-full"
          />
          <button
            type="button"
            onClick={openDialog}
            aria-label={t("homepage.kickstarter.notify")}
            className="absolute left-[3.65%] top-[63.45%] h-[10.3%] w-[23.3%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
          />
          {KICKSTARTER_URL ? (
            <a
              href={KICKSTARTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("homepage.kickstarter.visit")}
              className="absolute left-[27.97%] top-[63.45%] h-[10.3%] w-[22.9%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
            />
          ) : (
            <button
              type="button"
              onClick={() => setPageNotice(true)}
              aria-label={t("homepage.kickstarter.visit")}
              className="absolute left-[27.97%] top-[63.45%] h-[10.3%] w-[22.9%] rounded-full transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#05CE78]"
            />
          )}
        </div>
        {pageNotice && (
          <p role="status" className="px-5 pt-3 text-center text-sm text-[#D8B84C]">
            {t("homepage.kickstarter.pageComingSoon")}
          </p>
        )}
      </div>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-5 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="kickstarter-dialog-title" className="relative w-full max-w-md rounded-3xl border border-[#D8B84C]/30 bg-[#17130f] p-6 text-[#f8f2e7] shadow-2xl sm:p-8">
            <button type="button" onClick={() => setDialogOpen(false)} aria-label={t("homepage.kickstarter.close")} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-xl text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D8B84C]">×</button>
            {status === "success" ? (
              <div className="py-6 text-center" aria-live="polite">
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#05CE78]/15 text-2xl text-[#05CE78]">✓</div>
                <h2 id="kickstarter-dialog-title" className="mt-5 text-2xl font-semibold">{t("homepage.kickstarter.success")}</h2>
                <button type="button" onClick={() => setDialogOpen(false)} className="mt-6 rounded-full bg-[#05CE78] px-6 py-3 font-semibold text-[#07130d] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t("homepage.kickstarter.done")}</button>
              </div>
            ) : (
              <>
                <h2 id="kickstarter-dialog-title" className="pr-8 text-2xl font-semibold">{t("homepage.kickstarter.dialogTitle")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{t("homepage.kickstarter.dialogBody")}</p>
                <form onSubmit={submit} className="mt-6">
                  <label htmlFor="kickstarter-email" className="text-sm text-white/80">{t("homepage.kickstarter.emailLabel")}</label>
                  <input id="kickstarter-email" name="email" type="email" autoComplete="email" required maxLength={254} autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("homepage.kickstarter.emailPlaceholder")} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-black/30 px-4 text-base text-white outline-none placeholder:text-white/30 focus:border-[#05CE78] focus:ring-2 focus:ring-[#05CE78]/20" />
                  {status === "error" && <p role="alert" className="mt-3 text-sm text-red-300">{t("homepage.kickstarter.error")}</p>}
                  <button type="submit" disabled={status === "submitting"} className="mt-5 min-h-12 w-full rounded-full bg-[#05CE78] px-6 font-semibold text-[#07130d] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                    {status === "submitting" ? t("homepage.kickstarter.sending") : t("homepage.kickstarter.submit")}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
