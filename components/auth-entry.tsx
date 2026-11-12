"use client";

import { useLocale } from "@/components/locale-provider";
import { PaperShell } from "@/components/storybook/paper-shell";
import { UIUX_AUTH_ART } from "@/lib/uiux-art";
import Image from "next/image";
import { PrivacyConsentSheet } from "@/components/privacy-consent-sheet";
import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import { authCallbackUrl, authEmailOrigin, continueAfterAuth, passwordRecoveryCallbackUrl } from "@/lib/auth-redirect";
import { SITE_URL } from "@/lib/site-url";
import { logAuthFailure } from "@/lib/auth-diagnostics";
import { completePasswordSignupOnServer, createPasswordAccount, signInWithPassword, type PasswordAuthResult } from "@/lib/password-auth";
import { normalizeAuthEmail, type AuthMode } from "@/lib/passwordless-auth";
import { passwordValidationError, requestPasswordRecovery } from "@/lib/password-recovery";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type AuthErrorState = "invalid_link" | "unavailable" | "signup_unavailable" | "signin_unavailable" | "request_failed" | "already_registered" | "invalid_credentials" | "email_not_confirmed" | "policy_failed" | null;

export function AuthEntry({ returnTo, initialAuthError = null, passwordUpdated = false, initialMode }: { returnTo: string; initialAuthError?: AuthErrorState; passwordUpdated?: boolean; initialMode?: AuthMode }) {
  const { lang, t } = useLocale();
  const [mode, setMode] = useState<AuthMode>(passwordUpdated || initialMode === "signin" ? "signin" : "signup");
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
  const [localPreview, setLocalPreview] = useState(false);
  const [localPreviewError, setLocalPreviewError] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    const local = host === "localhost" || host.endsWith(".local") || host.startsWith("127.") || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
    setLocalPreview(local);
  }, []);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const emailValid = normalizeAuthEmail(email) !== null;
  const passwordError = passwordValidationError(password, mode === "signup" ? passwordConfirmation : password);
  const formValid = emailValid && !passwordError && (mode === "signin" || privacyConsent);
  const inputClass = `st-field ${bodyFont}`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    setShowErrors(true);
    if (!formValid) {
      if (mode === "signup" && !privacyConsent) setPrivacySheetOpen(true);
      return;
    }
    requestPending.current = true;
    setStatus("submitting");
    setAuthError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result: PasswordAuthResult = mode === "signup"
        ? await createPasswordAccount(client, { email, password, redirectTo: authCallbackUrl(window.location.origin, returnTo, lang), locale: lang, provision: completePasswordSignupOnServer })
        : await signInWithPassword(client, { email, password });
      if (result === "authenticated") {
        setPassword("");
        setPasswordConfirmation("");
        window.location.assign(continueAfterAuth(returnTo));
        return;
      }
      if (result === "check_email") {
        setPassword("");
        setPasswordConfirmation("");
        setStatus("check_email");
        return;
      }
      if (result === "email_not_confirmed") {
        const confirmed = await completePasswordSignupOnServer({ email, password, locale: lang });
        if (confirmed === "created") {
          const retry = await signInWithPassword(client, { email, password });
          if (retry === "authenticated") {
            setPassword("");
            setPasswordConfirmation("");
            window.location.assign(continueAfterAuth(returnTo));
            return;
          }
        }
      }
      if (result === "already_registered") {
        setMode("signin");
        setPassword("");
        setPasswordConfirmation("");
        setShowErrors(false);
        setStatus("idle");
        setAuthError("already_registered");
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
      const result = await requestPasswordRecovery(client, { email, redirectTo: passwordRecoveryCallbackUrl(authEmailOrigin(window.location.origin, SITE_URL), returnTo, lang) });
      setRecoveryStatus(result === "sent" ? "sent" : "request_failed");
    } catch {
      setRecoveryStatus("request_failed");
    } finally {
      requestPending.current = false;
    }
  };

  const switchMode = () => {
    const next = mode === "signup" ? "signin" : "signup";
    setMode(next);
    setPasswordConfirmation("");
    setPasswordVisible(false);
    setPasswordConfirmationVisible(false);
    setShowErrors(false);
    setAuthError(null);
    setStatus("idle");
    if (next === "signup") setPassword("");
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
    <PaperShell brand backHref="/" current="home" showTabs={false}>
      <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pb-8">
        <div className="mt-1 overflow-hidden rounded-[22px]">
          <Image src={UIUX_AUTH_ART} alt="" width={846} height={456} sizes="430px" className="h-auto w-full" priority />
        </div>
        <h1 className={`st-headline mt-6 text-center text-[1.85rem] text-[#393129] ${lang === "ko" ? "break-keep" : "tracking-[0.01em]"}`}>
          {t(recoveryOpen ? "auth.recovery.requestTitle" : mode === "signup" ? "auth.signupTitle" : "auth.signinTitle")}
        </h1>
        {passwordUpdated && !recoveryOpen ? <p role="status" className={`mt-6 rounded-xl border border-[#eadcc6] bg-[#fff8ec] px-5 py-4 text-center text-sm text-[#594b3c] ${bodyFont}`}>{t("auth.recovery.updated")}</p> : null}
        {recoveryOpen ? (
          recoveryStatus === "sent" ? <Status title={t("auth.checkEmailTitle")} body={t("auth.recovery.checkEmail")} className={bodyFont} /> :
          <form className="mt-6 space-y-4" onSubmit={handleRecoverySubmit} noValidate>
            <Field id="recovery-email" label={t("form.emailLabel")} type="email" autoComplete="email" value={email} onChange={setEmail} className={inputClass} placeholder={t("auth.emailPlaceholder")} />
            {showErrors && !emailValid ? <p role="alert" className="text-xs text-[#b97064]">{t(email.trim() ? "form.validation.emailInvalid" : "form.validation.emailRequired")}</p> : null}
            <PrimaryButton disabled={recoveryStatus === "sending"} className={bodyFont}>{t(recoveryStatus === "sending" ? "auth.recovery.sending" : "auth.recovery.sendLink")}</PrimaryButton>
            {recoveryStatus === "request_failed" ? <p role="alert" className="text-center text-xs text-[#b97064]">{t("auth.recovery.request_failed")}</p> : null}
          </form>
        ) : status === "check_email" ? (
          <div className="mt-8 space-y-4">
            <Status title={t("auth.signinTitle")} body={t("auth.errors.already_registered")} className={bodyFont} />
            <button type="button" onClick={() => { setStatus("idle"); setMode("signin"); setAuthError(null); }} className={`st-btn st-btn-primary w-full ${bodyFont}`}>{t("auth.signInButton")}</button>
          </div>
        ) :
        <form id="auth-form" className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <Field id="auth-email" label={t("form.emailLabel")} type="email" autoComplete="email" value={email} onChange={setEmail} className={inputClass} placeholder={t("auth.emailPlaceholder")} />
          {showErrors && !emailValid ? <p role="alert" className="text-xs text-[#b97064]">{t(email.trim() ? "form.validation.emailInvalid" : "form.validation.emailRequired")}</p> : null}
          <PasswordField id="auth-password" label={t("auth.password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={setPassword} className={inputClass} visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} toggleLabel={t(passwordVisible ? "auth.hidePassword" : "auth.showPassword")} />
          {mode === "signup" ? <PasswordField id="auth-password-confirmation" label={t("auth.confirmPassword")} autoComplete="new-password" value={passwordConfirmation} onChange={setPasswordConfirmation} className={inputClass} visible={passwordConfirmationVisible} onToggle={() => setPasswordConfirmationVisible((current) => !current)} toggleLabel={t(passwordConfirmationVisible ? "auth.hideConfirmPassword" : "auth.showConfirmPassword")} /> : null}
          {showErrors && passwordError ? <p role="alert" className="text-xs text-[#b97064]">{t(`auth.passwordValidation.${passwordError}`)}</p> : null}
          {mode === "signup" ? <div className="space-y-2"><PrivacyConsentTrigger agreed={privacyConsent} onOpen={() => setPrivacySheetOpen(true)} labelPath="form.privacyConsentLink" />{showErrors && !privacyConsent ? <p role="alert" className={`text-xs text-[#b97064] ${bodyFont}`}>{t("form.validation.privacyRequired")}</p> : null}</div> : null}
          <PrimaryButton disabled={status === "submitting"} className={bodyFont}>{t(status === "submitting" ? "auth.submitting" : mode === "signup" ? "auth.signUpButton" : "auth.signInButton")}</PrimaryButton>
          {mode === "signin" ? <button type="button" onClick={switchMode} className={`st-btn min-h-14 w-full rounded-full border-2 border-[#3a452f] bg-transparent px-5 py-4 text-base text-[#3a452f] ${bodyFont}`}>{t("auth.createAccount")}</button> : null}
          {authError ? <div role="alert" className={`text-center text-xs font-light leading-6 text-[#b97064] ${bodyFont}`}><p>{t(`auth.errors.${authError}`)}</p>{authError === "invalid_credentials" || authError === "already_registered" ? <button type="button" onClick={openRecovery} className="st-link mt-2">{t("auth.forgotPassword")}</button> : null}</div> : null}
        </form>}
        {!recoveryOpen && status !== "check_email" && mode === "signup" ? <div className={`mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm ${bodyFont}`}><span className="text-[#857666]">{t("auth.registered")}</span><button type="button" onClick={switchMode} className="st-link">{t("auth.signIn")}</button></div> : null}
        {mode === "signin" && !recoveryOpen && status !== "check_email" ? <div className={`mt-4 flex flex-wrap justify-center gap-x-4 gap-y-3 text-sm ${bodyFont}`}><button type="button" onClick={openRecovery} className="st-link">{t("auth.forgotPassword")}</button><span className="text-[#cbb58e]" aria-hidden="true">|</span><a href="/terms-of-service" className="st-link">{t("homepage.footer.termsOfService")}</a></div> : null}
        {recoveryOpen ? <button type="button" onClick={() => { setRecoveryOpen(false); setRecoveryStatus("idle"); setShowErrors(false); }} className={`st-link mt-5 w-full text-center text-sm ${bodyFont}`}>{t("auth.recovery.back")}</button> : null}
        {localPreview && !recoveryOpen ? <button type="button" onClick={() => { void (async () => { setLocalPreviewError(false); const response = await fetch("/api/auth/local-preview", { method: "POST" }); if (!response.ok) { setLocalPreviewError(true); return; } window.location.assign(continueAfterAuth(returnTo)); })(); }} className={`st-btn mt-6 min-h-14 w-full rounded-full border-2 border-[#3a452f] bg-transparent px-5 py-4 text-base text-[#3a452f] ${bodyFont}`}>이 컴퓨터에서 시험 로그인</button> : null}
        {localPreviewError ? <p role="alert" className="mt-2 text-center text-xs text-[#b97064]">시험 로그인을 열지 못했어요.</p> : null}
      </main>
      <PrivacyConsentSheet open={privacySheetOpen} onClose={() => setPrivacySheetOpen(false)} titlePath="form.privacyConsentTitle" bodyPath="form.privacyConsentBody" agreePath="form.privacyConsentAgree" checked={privacyConsent} onConfirm={() => setPrivacyConsent(true)} />
    </PaperShell>
  );
}

function Field({ id, label, type, autoComplete, value, onChange, className, placeholder }: { id: string; label: string; type: "email" | "password"; autoComplete: string; value: string; onChange: (value: string) => void; className: string; placeholder?: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-light">{label}</label><input id={id} type={type} inputMode={type === "email" ? "email" : undefined} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-14 rounded-full px-5`} /></div>;
}
function PasswordField({ id, label, autoComplete, value, onChange, className, visible, onToggle, toggleLabel }: { id: string; label: string; autoComplete: string; value: string; onChange: (value: string) => void; className: string; visible: boolean; onToggle: () => void; toggleLabel: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-light">{label}</label><div className="relative"><input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-14 rounded-full px-5 pr-14`} /><button type="button" onClick={onToggle} aria-label={toggleLabel} aria-pressed={visible} className="absolute inset-y-0 right-1 flex min-h-11 min-w-11 items-center justify-center rounded-full text-[#9e774c] transition hover:text-[#7a5f48] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#9e774c]"><PasswordVisibilityIcon visible={visible} /></button></div></div>;
}
function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-5">{visible ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 8 9 8a16 16 0 0 1-2.1 3.3" /><path d="M6.6 6.6C4.2 8.2 3 12 3 12s3.5 8 9 8a9.7 9.7 0 0 0 4-.9" /></> : <><path d="M3 12s3.5-8 9-8 9 8 9 8-3.5 8-9 8-9-8-9-8Z" /><circle cx="12" cy="12" r="2.5" /></>}</svg>;
}
function PrimaryButton({ disabled, className, children }: { disabled: boolean; className: string; children: ReactNode }) {
  return <button type="submit" disabled={disabled} className={`st-btn st-btn-forest min-h-14 w-full rounded-full px-5 py-4 text-base disabled:cursor-not-allowed disabled:opacity-55 ${className}`}>{children}</button>;
}
function Status({ title, body, className }: { title: string; body: string; className: string }) {
  return <div role="status" className={`mt-8 rounded-2xl border border-[#eadcc6] bg-[#fff8ec] px-5 py-6 text-center ${className}`}><p className="st-headline text-lg text-[#393129]">{title}</p><p className="mt-2 text-sm leading-7 text-[#857666]">{body}</p></div>;
}
