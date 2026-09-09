"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { safeAuthReturnPath } from "@/lib/auth-redirect";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { passwordValidationError, updateRecoveryPassword } from "@/lib/password-recovery";
import { useRef, useState, type FormEvent } from "react";

export function PasswordUpdateForm({ returnTo }: { returnTo: string }) {
  const { lang, t } = useLocale();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "policy_failed" | "request_failed">("idle");
  const pending = useRef(false);
  const validation = passwordValidationError(password, confirmation);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    setShowErrors(true);
    if (validation) return;
    pending.current = true;
    setStatus("saving");
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await updateRecoveryPassword(client, password);
      if (result === "updated") {
        setPassword("");
        setConfirmation("");
        const destination = new URL("/auth", window.location.origin);
        destination.searchParams.set("returnTo", safeAuthReturnPath(returnTo));
        destination.searchParams.set("passwordUpdated", "1");
        window.location.assign(`${destination.pathname}${destination.search}`);
        return;
      }
      setStatus(result);
    } catch {
      setStatus("request_failed");
    } finally {
      pending.current = false;
    }
  };

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-6 py-10 text-[#F3EAD8] sm:px-8">
      <section className="w-full max-w-[460px] rounded-[22px] border border-[#D4AF37]/30 bg-[rgba(16,14,11,0.86)] px-5 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.65)] sm:px-8 sm:py-10">
        <div className="flex justify-end"><LanguageToggle /></div>
        <h1 className={`mt-5 text-center text-3xl font-light text-[#FFF6E5] ${bodyFont}`}>{t("auth.recovery.updateTitle")}</h1>
        <p className={`mt-3 text-center text-sm leading-7 text-[#EDE4D3]/72 ${bodyFont}`}>{t("auth.recovery.updateBody")}</p>
        <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <label htmlFor="new-password" className={bodyFont}>{t("auth.recovery.newPassword")}</label>
            <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`w-full rounded-xl border border-[#D4AF37]/35 bg-black/35 px-4 py-3.5 text-white ${bodyFont}`} />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-new-password" className={bodyFont}>{t("auth.recovery.confirmPassword")}</label>
            <input id="confirm-new-password" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={`w-full rounded-xl border border-[#D4AF37]/35 bg-black/35 px-4 py-3.5 text-white ${bodyFont}`} />
          </div>
          {showErrors && validation ? <p role="alert" className={`text-sm text-red-200 ${bodyFont}`}>{t(`auth.recovery.${validation}`)}</p> : null}
          {status === "policy_failed" || status === "request_failed" ? <p role="alert" className={`text-sm text-red-200 ${bodyFont}`}>{t(`auth.recovery.${status}`)}</p> : null}
          <button type="submit" disabled={status === "saving"} className={`min-h-14 w-full rounded-xl bg-[#B89A2E] px-5 py-4 text-black disabled:opacity-55 ${bodyFont}`}>{t(status === "saving" ? "auth.recovery.saving" : "auth.recovery.savePassword")}</button>
        </form>
      </section>
    </main>
  );
}
