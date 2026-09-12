"use client";

import { LanguageToggle } from "@/components/language-toggle";
import { useLocale } from "@/components/locale-provider";
import { PrivacyConsentSheet } from "@/components/privacy-consent-sheet";
import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import { authCallbackUrl, passwordRecoveryCallbackUrl } from "@/lib/auth-redirect";
import { logAuthFailure } from "@/lib/auth-diagnostics";
import { createPasswordAccount, signInWithPassword, type PasswordAuthResult } from "@/lib/password-auth";
import { normalizeAuthEmail, type AuthMode } from "@/lib/passwordless-auth";
import { passwordValidationError, requestPasswordRecovery } from "@/lib/password-recovery";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";

type AuthErrorState = "invalid_link" | "unavailable" | "signup_unavailable" | "signin_unavailable" | "request_failed" | "invalid_credentials" | "email_not_confirmed" | "policy_failed" | null;

export function AuthEntry({ returnTo, initialAuthError = null, passwordUpdated = false }: { returnTo: string; initialAuthError?: AuthErrorState; passwordUpdated?: boolean }) {
  const { lang, t } = useLocale();
  const [mode, setMode] = useState<AuthMode>(passwordUpdated ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "check_email">("idle");
  const [authError, setAuthError] = useState<AuthErrorState>(initialAuthError);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<"idle" | "sending" | "sent" | "request_failed">("idle");
  const requestPending = useRef(false);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const emailValid = normalizeAuthEmail(email) !== null;
  const passwordError = passwordValidationError(password, mode === "signup" ? passwordConfirmation : password);
  const formValid = emailValid && !passwordError && (mode === "signin" || privacyConsent);
  const inputClass = `w-full rounded-xl border border-[#D4AF37]/35 bg-black/35 px-4 py-3.5 text-base text-white outline-none transition placeholder:text-[#EDE4D3]/35 focus:border-[#D4AF37] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37] ${bodyFont}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    setShowErrors(true);
    if (!formValid) return;
    requestPending.current = true;
    setStatus("submitting");
    setAuthError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result: PasswordAuthResult = mode === "signup"
        ? await createPasswordAccount(client, { email, password, redirectTo: authCallbackUrl(window.location.origin, returnTo, lang), locale: lang })
        : await signInWithPassword(client, { email, password });
      if (result === "authenticated") {
        setPassword("");
        setPasswordConfirmation("");
        window.location.assign(returnTo);
        return;
      }
      if (result === "check_email") {
        setPassword("");
        setPasswordConfirmation("");
        setStatus("check_email");
        return;
      }
      setStatus("idle");
      setAuthError(result === "invalid_email" ? "request_failed" : result);
    } catch (error) {
      logAuthFailure("browser-client", error);
      setStatus("idle");
      setAuthError(mode === "signup" ? "signup_unavailable" : "signin_unavailable");
    } finally {
      requestPending.current = false;
    }
  };

  const handleRecoverySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    setShowErrors(true);
    if (!emailValid) return;
    requestPending.current = true;
    setRecoveryStatus("sending");
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await requestPasswordRecovery(client, { email, redirectTo: passwordRecoveryCallbackUrl(window.location.origin, returnTo, lang) });
      setRecoveryStatus(result === "sent" ? "sent" : "request_failed");
    } catch {
      setRecoveryStatus("request_failed");
    } finally {
      requestPending.current = false;
    }
  };

  const switchMode = () => {
    setMode((current) => current === "signup" ? "signin" : "signup");
    setPassword("");
    setPasswordConfirmation("");
    setPasswordVisible(false);
    setPasswordConfirmationVisible(false);
    setShowErrors(false);
    setAuthError(null);
    setStatus("idle");
  };
  const openRecovery = () => {
    setRecoveryOpen(true);
    setPassword("");
    setPasswordConfirmation("");
    setPasswordVisible(false);
    setPasswordConfirmationVisible(false);
    setShowErrors(false);
    setRecoveryStatus("idle");
  };

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden bg-black px-6 py-10 text-[#F3EAD8] sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_18%,rgba(212,175,55,0.12),transparent_35%),radial-gradient(circle_at_12%_82%,rgba(184,137,61,0.07),transparent_28%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
      <div className="w-full max-w-[460px]">
        <header className="mb-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Link href={returnTo} aria-label={t("auth.backHome")} className="font-display-en w-fit text-xs tracking-[0.24em] text-[#E8D6B4]/80 transition hover:text-[#D4AF37] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] sm:text-sm">SOUL TRACE</Link>
          <span aria-hidden="true" /><div className="justify-self-end"><LanguageToggle /></div>
        </header>
        <section className="rounded-[22px] border border-[#D4AF37]/30 bg-[rgba(16,14,11,0.86)] px-5 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm sm:px-8 sm:py-10">
          <div className="text-center">
            <p className="font-display-en text-[10px] uppercase tracking-[0.38em] text-[#D4AF37]/85 sm:text-xs">{t("auth.eyebrow")}</p>
            <h1 className={`mt-4 text-3xl font-light leading-tight text-[#FFF6E5] sm:text-[2.15rem] ${lang === "ko" ? "font-ko break-keep" : "font-display-en tracking-[0.035em]"}`}>{t(recoveryOpen ? "auth.recovery.requestTitle" : mode === "signup" ? "auth.signupTitle" : "auth.signinTitle")}</h1>
            <p className={`mx-auto mt-3 max-w-sm text-sm font-extralight leading-7 text-[#EDE4D3]/72 ${bodyFont}`}>{t(recoveryOpen ? "auth.recovery.requestBody" : mode === "signup" ? "auth.signupBody" : "auth.signinBody")}</p>
          </div>
          {passwordUpdated && !recoveryOpen ? <p role="status" className={`mt-8 rounded-xl border border-[#D4AF37]/35 px-5 py-4 text-center text-sm text-[#F5E6B8] ${bodyFont}`}>{t("auth.recovery.updated")}</p> : null}
          {recoveryOpen ? (
            recoveryStatus === "sent" ? <Status title={t("auth.checkEmailTitle")} body={t("auth.recovery.checkEmail")} className={bodyFont} /> :
            <form className="mt-8 space-y-5" onSubmit={handleRecoverySubmit} noValidate>
              <Field id="recovery-email" label={t("form.emailLabel")} type="email" autoComplete="email" value={email} onChange={setEmail} className={inputClass} />
              {showErrors && !emailValid ? <p role="alert" className="text-xs text-red-200">{t(email.trim() ? "form.validation.emailInvalid" : "form.validation.emailRequired")}</p> : null}
              <PrimaryButton disabled={recoveryStatus === "sending"} className={bodyFont}>{t(recoveryStatus === "sending" ? "auth.recovery.sending" : "auth.recovery.sendLink")}</PrimaryButton>
              {recoveryStatus === "request_failed" ? <p role="alert" className="text-center text-xs text-red-200">{t("auth.recovery.request_failed")}</p> : null}
            </form>
          ) : status === "check_email" ? <Status title={t("auth.checkEmailTitle")} body={t("auth.checkEmailBody")} className={bodyFont} /> :
          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <Field id="auth-email" label={t("form.emailLabel")} type="email" autoComplete="email" value={email} onChange={setEmail} className={inputClass} />
            {showErrors && !emailValid ? <p role="alert" className="text-xs text-red-200">{t(email.trim() ? "form.validation.emailInvalid" : "form.validation.emailRequired")}</p> : null}
            <PasswordField id="auth-password" label={t("auth.password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={setPassword} className={inputClass} visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} toggleLabel={t(passwordVisible ? "auth.hidePassword" : "auth.showPassword")} />
            {mode === "signup" ? <PasswordField id="auth-password-confirmation" label={t("auth.confirmPassword")} autoComplete="new-password" value={passwordConfirmation} onChange={setPasswordConfirmation} className={inputClass} visible={passwordConfirmationVisible} onToggle={() => setPasswordConfirmationVisible((current) => !current)} toggleLabel={t(passwordConfirmationVisible ? "auth.hideConfirmPassword" : "auth.showConfirmPassword")} /> : null}
            {showErrors && passwordError ? <p role="alert" className="text-xs text-red-200">{t(`auth.passwordValidation.${passwordError}`)}</p> : null}
            {mode === "signup" ? <div className="space-y-2"><PrivacyConsentTrigger agreed={privacyConsent} onOpen={() => setPrivacySheetOpen(true)} labelPath="form.privacyConsentLink" />{showErrors && !privacyConsent ? <p role="alert" className={`text-xs text-red-200 ${bodyFont}`}>{t("form.validation.privacyRequired")}</p> : null}</div> : null}
            <PrimaryButton disabled={status === "submitting"} className={bodyFont}>{t(status === "submitting" ? "auth.submitting" : mode === "signup" ? "auth.signUpButton" : "auth.signInButton")}</PrimaryButton>
            {authError ? <div role="alert" className={`text-center text-xs font-light leading-6 text-red-200 ${bodyFont}`}><p>{t(`auth.errors.${authError}`)}</p>{mode === "signin" && authError === "invalid_credentials" ? <p className="mt-2 text-[#EDE4D3]/72">{t("auth.passwordlessGuidance")}</p> : null}</div> : null}
          </form>}
          {!recoveryOpen && status !== "check_email" ? <div className={`mt-7 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-extralight ${bodyFont}`}>{mode === "signup" ? <span className="text-[#EDE4D3]/60">{t("auth.registered")}</span> : null}<button type="button" onClick={switchMode} className="rounded-sm text-[#D4AF37] underline decoration-[#D4AF37]/45 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]">{t(mode === "signup" ? "auth.signIn" : "auth.createAccount")}</button></div> : null}
          {mode === "signin" && !recoveryOpen && status !== "check_email" ? <div className={`mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm ${bodyFont}`}><button type="button" onClick={openRecovery} className="text-[#D4AF37]/80 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]">{t("auth.forgotPassword")}</button><button type="button" onClick={openRecovery} className="text-[#D4AF37]/80 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]">{t("auth.recovery.open")}</button></div> : null}
          {recoveryOpen ? <button type="button" onClick={() => { setRecoveryOpen(false); setRecoveryStatus("idle"); setShowErrors(false); }} className={`mt-5 w-full text-center text-sm text-[#D4AF37] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37] ${bodyFont}`}>{t("auth.recovery.back")}</button> : null}
        </section>
      </div>
      <PrivacyConsentSheet open={privacySheetOpen} onClose={() => setPrivacySheetOpen(false)} titlePath="form.privacyConsentTitle" bodyPath="form.privacyConsentBody" agreePath="form.privacyConsentAgree" checked={privacyConsent} onConfirm={() => setPrivacyConsent(true)} />
    </main>
  );
}

function Field({ id, label, type, autoComplete, value, onChange, className }: { id: string; label: string; type: "email" | "password"; autoComplete: string; value: string; onChange: (value: string) => void; className: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-light">{label}</label><input id={id} type={type} inputMode={type === "email" ? "email" : undefined} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className={className} /></div>;
}
function PasswordField({ id, label, autoComplete, value, onChange, className, visible, onToggle, toggleLabel }: { id: string; label: string; autoComplete: string; value: string; onChange: (value: string) => void; className: string; visible: boolean; onToggle: () => void; toggleLabel: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-light">{label}</label><div className="relative"><input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} pr-14`} /><button type="button" onClick={onToggle} aria-label={toggleLabel} aria-pressed={visible} className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#E8D6B4]/65 transition hover:text-[#D4AF37] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#D4AF37]"><PasswordVisibilityIcon visible={visible} /></button></div></div>;
}
function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5">{visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 8 9 8a16 16 0 0 1-2.1 3.3" /><path d="M6.6 6.6C4.2 8.2 3 12 3 12s3.5 8 9 8a9.7 9.7 0 0 0 4-.9" /></> : <><path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="2.5" /></>}</svg>;
}
function PrimaryButton({ disabled, className, children }: { disabled: boolean; className: string; children: ReactNode }) {
  return <button type="submit" disabled={disabled} className={`min-h-14 w-full rounded-xl bg-[#B89A2E] px-5 py-4 text-base font-light text-black transition hover:bg-[#C6A637] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F3EAD8] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}>{children}</button>;
}
function Status({ title, body, className }: { title: string; body: string; className: string }) {
  return <div role="status" className={`mt-8 rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/[0.06] px-5 py-6 text-center ${className}`}><p className="text-lg font-light text-[#F5E6B8]">{title}</p><p className="mt-2 text-sm font-extralight leading-7 text-[#EDE4D3]/72">{body}</p></div>;
}
