"use client";

import { useLocale } from "@/components/locale-provider";
import { EternalBeamLogo } from "@/components/storybook/eternal-beam-logo";
import { PaperShell } from "@/components/storybook/paper-shell";
import { UIUX_AUTH_ART } from "@/lib/uiux-art";
import Image from "next/image";
import { PrivacyConsentSheet } from "@/components/privacy-consent-sheet";
import { PrivacyConsentTrigger } from "@/components/privacy-consent-trigger";
import { authCallbackUrl, continueAfterAuth, newAccountProfilePath, passwordRecoveryCallbackUrl } from "@/lib/auth-redirect";
import { logAuthFailure } from "@/lib/auth-diagnostics";
import { createPasswordAccount, resendPasswordSignupOtp, signInWithPassword, verifyPasswordSignupOtp, type PasswordAuthResult } from "@/lib/password-auth";
import { normalizeAuthEmail, type AuthMode } from "@/lib/passwordless-auth";
import { passwordValidationError, requestPasswordRecovery } from "@/lib/password-recovery";
import { maskEmail } from "@/lib/pending-contact-email";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

type AuthErrorState = "invalid_link" | "unavailable" | "signup_unavailable" | "signin_unavailable" | "request_failed" | "already_registered" | "invalid_credentials" | "email_not_confirmed" | "confirmation_unavailable" | "invalid_code" | "otp_expired" | "resend_wait" | "policy_failed" | null;
const OTP_RESEND_COOLDOWN_MS = 30_000;

export function AuthEntry({ returnTo, initialAuthError = null, passwordUpdated = false, initialMode }: { returnTo: string; initialAuthError?: AuthErrorState; passwordUpdated?: boolean; initialMode?: AuthMode }) {
  const { lang, t } = useLocale();
  const [mode, setMode] = useState<AuthMode>(passwordUpdated || initialMode === "signin" ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationDestination, setConfirmationDestination] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [, setTimerTick] = useState(0);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "check_email" | "verifying" | "resending">("idle");
  const [authError, setAuthError] = useState<AuthErrorState>(initialAuthError);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<"idle" | "sending" | "sent" | "request_failed">("idle");
  const requestPending = useRef(false);
  const bodyFont = lang === "ko" ? "font-ko" : "font-display-en";
  const emailValid = normalizeAuthEmail(email) !== null;
  const passwordError = passwordValidationError(password, mode === "signup" ? passwordConfirmation : password);
  const formValid = emailValid && !passwordError && (mode === "signin" || privacyConsent);
  const inputClass = `st-field ${bodyFont}`;
  const newProfilePath = newAccountProfilePath(returnTo);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

  useEffect(() => {
    if (status !== "check_email" || Date.now() >= resendAvailableAt) return;
    const timer = window.setInterval(() => {
      setTimerTick((value) => value + 1);
      if (Date.now() >= resendAvailableAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status, resendAvailableAt]);

  const beginEmailConfirmation = (destination: string) => {
    setConfirmationDestination(destination);
    setOtp("");
    setResendAvailableAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
    setStatus("check_email");
    setAuthError(null);
  };

  const confirmationRedirectTo = (destination: string) =>
    authCallbackUrl(window.location.origin, destination, lang);

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
        ? await createPasswordAccount(client, { email, password, redirectTo: confirmationRedirectTo(newProfilePath), locale: lang })
        : await signInWithPassword(client, { email, password });
      if (result === "authenticated") {
        setPassword("");
        setPasswordConfirmation("");
        window.location.assign(continueAfterAuth(mode === "signup" ? newProfilePath : returnTo));
        return;
      }
      if (result === "check_email") {
        setPassword("");
        setPasswordConfirmation("");
        beginEmailConfirmation(newProfilePath);
        return;
      }
      if (result === "email_not_confirmed") {
        const resent = await resendPasswordSignupOtp(client, {
          email,
          redirectTo: confirmationRedirectTo(returnTo),
        });
        if (resent === "sent") {
          setPassword("");
          setPasswordConfirmation("");
          beginEmailConfirmation(returnTo);
          return;
        }
      }
      if (result === "confirmation_unavailable") {
        setStatus("idle");
        setAuthError("confirmation_unavailable");
        return;
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

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setStatus("verifying");
    setAuthError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await verifyPasswordSignupOtp(client, { email, code: otp });
      if (result === "authenticated") {
        setOtp("");
        setPassword("");
        setPasswordConfirmation("");
        window.location.assign(continueAfterAuth(confirmationDestination ?? newProfilePath));
        return;
      }
      setStatus("check_email");
      setAuthError(result === "expired" ? "otp_expired" : result === "invalid_code" ? "invalid_code" : "request_failed");
    } catch (error) {
      logAuthFailure("browser-client", error);
      setStatus("check_email");
      setAuthError("request_failed");
    } finally {
      requestPending.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (requestPending.current) return;
    if (Date.now() < resendAvailableAt) {
      setAuthError("resend_wait");
      return;
    }
    requestPending.current = true;
    setStatus("resending");
    setAuthError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await resendPasswordSignupOtp(client, {
        email,
        redirectTo: confirmationRedirectTo(confirmationDestination ?? newProfilePath),
      });
      if (result === "sent") {
        setOtp("");
        setResendAvailableAt(Date.now() + OTP_RESEND_COOLDOWN_MS);
        setStatus("check_email");
      } else {
        setStatus("check_email");
        setAuthError("request_failed");
      }
    } catch (error) {
      logAuthFailure("browser-client", error);
      setStatus("check_email");
      setAuthError("request_failed");
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
    <PaperShell brand backHref="/" current="home" showTabs={false}>
      <main className="mx-auto w-full max-w-[430px] flex-1 px-5 pb-8">
        <div className="relative mt-1 aspect-[16/9] overflow-hidden rounded-[22px] bg-[#f3e6cf]">
          <Image src={UIUX_AUTH_ART} alt="" fill sizes="430px" className="object-cover object-[center_12%]" priority />
        </div>
        <div className="mt-5 flex flex-col items-center text-center">
          <EternalBeamLogo className="h-auto w-32" />
          <p className="mt-2 font-display-en text-3xl tracking-[0.04em] text-[#3a452f]">SoulTrace</p>
          <p className={`mt-2 text-sm text-[#7a6c5c] ${bodyFont}`}>{t("splash.tagline")}</p>
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
        ) : status === "check_email" || status === "verifying" || status === "resending" ? (
          <div className="mt-8 space-y-4">
            <Status
              title={t(status === "verifying" ? "auth.verifyingCode" : status === "resending" ? "auth.resendingCode" : "auth.checkEmailTitle")}
              body={t("auth.signupOtpBody").replace("%EMAIL%", maskEmail(email))}
              className={bodyFont}
            />
            <form className="space-y-4" onSubmit={handleOtpSubmit} noValidate>
              <Field
                id="auth-signup-otp"
                label={t("auth.confirmationCodeLabel")}
                type="text"
                autoComplete="one-time-code"
                value={otp}
                onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 8))}
                className={inputClass}
                placeholder={t("auth.confirmationCodePlaceholder")}
              />
              {authError ? <p role="alert" className="text-center text-xs text-[#b97064]">{t(`auth.errors.${authError}`)}</p> : null}
              <PrimaryButton disabled={status !== "check_email" || otp.length < 6} className={bodyFont}>{t("auth.verifyCode")}</PrimaryButton>
            </form>
            <button
              type="button"
              disabled={status !== "check_email" || resendSeconds > 0}
              onClick={() => void handleResendOtp()}
              className={`st-btn st-btn-quiet w-full disabled:cursor-not-allowed disabled:opacity-55 ${bodyFont}`}
            >
              {resendSeconds > 0 ? t("auth.resendCodeWait").replace("%SECONDS%", String(resendSeconds)) : t("auth.resendCode")}
            </button>
            <button type="button" onClick={() => { setStatus("idle"); setMode("signin"); setOtp(""); setAuthError(null); }} className={`st-link w-full text-center ${bodyFont}`}>{t("auth.signInButton")}</button>
          </div>
        ) :
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <Field id="auth-email" label={t("form.emailLabel")} type="email" autoComplete="email" value={email} onChange={setEmail} className={inputClass} placeholder={t("auth.emailPlaceholder")} />
          {showErrors && !emailValid ? <p role="alert" className="text-xs text-[#b97064]">{t(email.trim() ? "form.validation.emailInvalid" : "form.validation.emailRequired")}</p> : null}
          <PasswordField id="auth-password" label={t("auth.password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={setPassword} className={inputClass} visible={passwordVisible} onToggle={() => setPasswordVisible((current) => !current)} toggleLabel={t(passwordVisible ? "auth.hidePassword" : "auth.showPassword")} />
          {mode === "signup" ? <PasswordField id="auth-password-confirmation" label={t("auth.confirmPassword")} autoComplete="new-password" value={passwordConfirmation} onChange={setPasswordConfirmation} className={inputClass} visible={passwordConfirmationVisible} onToggle={() => setPasswordConfirmationVisible((current) => !current)} toggleLabel={t(passwordConfirmationVisible ? "auth.hideConfirmPassword" : "auth.showConfirmPassword")} /> : null}
          {showErrors && passwordError ? <p role="alert" className="text-xs text-[#b97064]">{t(`auth.passwordValidation.${passwordError}`)}</p> : null}
          {mode === "signup" ? <div className="space-y-2"><PrivacyConsentTrigger agreed={privacyConsent} onOpen={() => setPrivacySheetOpen(true)} labelPath="form.privacyConsentLink" />{showErrors && !privacyConsent ? <p role="alert" className={`text-xs text-[#b97064] ${bodyFont}`}>{t("form.validation.privacyRequired")}</p> : null}</div> : null}
          <PrimaryButton disabled={status !== "idle"} className={bodyFont}>{t(status === "submitting" ? "auth.submitting" : mode === "signup" ? "auth.signUpButton" : "auth.signInButton")}</PrimaryButton>
          {mode === "signin" ? <button type="button" onClick={switchMode} className={`st-btn min-h-14 w-full rounded-full border-2 border-[#3a452f] bg-transparent px-5 py-4 text-base text-[#3a452f] ${bodyFont}`}>{t("auth.createAccount")}</button> : null}
          {authError ? <div role="alert" className={`text-center text-xs font-light leading-6 text-[#b97064] ${bodyFont}`}><p>{t(`auth.errors.${authError}`)}</p></div> : null}
        </form>}
        {!recoveryOpen && status !== "check_email" && mode === "signup" ? <div className={`mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm ${bodyFont}`}><span className="text-[#857666]">{t("auth.registered")}</span><button type="button" onClick={switchMode} className="st-link">{t("auth.signIn")}</button></div> : null}
        {mode === "signin" && !recoveryOpen && status !== "check_email" ? <div className={`mt-4 flex flex-wrap justify-center gap-x-4 gap-y-3 text-sm ${bodyFont}`}><button type="button" onClick={openRecovery} className="st-link">{t("auth.forgotPassword")}</button><span className="text-[#cbb58e]" aria-hidden="true">|</span><a href="/terms-of-service" className="st-link">{t("homepage.footer.termsOfService")}</a></div> : null}
        {recoveryOpen ? <button type="button" onClick={() => { setRecoveryOpen(false); setRecoveryStatus("idle"); setShowErrors(false); }} className={`st-link mt-5 w-full text-center text-sm ${bodyFont}`}>{t("auth.recovery.back")}</button> : null}
      </main>
      <PrivacyConsentSheet open={privacySheetOpen} onClose={() => setPrivacySheetOpen(false)} titlePath="form.privacyConsentTitle" bodyPath="form.privacyConsentBody" agreePath="form.privacyConsentAgree" checked={privacyConsent} onConfirm={() => setPrivacyConsent(true)} />
    </PaperShell>
  );
}

function Field({ id, label, type, autoComplete, value, onChange, className, placeholder }: { id: string; label: string; type: "email" | "password" | "text"; autoComplete: string; value: string; onChange: (value: string) => void; className: string; placeholder?: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="text-sm font-light">{label}</label><input id={id} type={type} inputMode={type === "email" ? "email" : type === "text" ? "numeric" : undefined} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className={`${className} min-h-14 rounded-full px-5`} /></div>;
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
