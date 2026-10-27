
"use client";

import { useLocale } from "@/components/locale-provider";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { logAuthFailure } from "@/lib/auth-diagnostics";
import {
  requestLetterDownloadCode,
  verifyLetterDownloadCode,
} from "@/lib/letter-download-auth";
import { maskEmail } from "@/lib/pending-contact-email";
import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

type LetterDownloadGateProps = {
  open: boolean;
  purpose: "letter" | "letter-generation" | "seasonal-polaroid";
  pendingEmail?: string | null;
  onClose: () => void;
  onVerified: () => Promise<"saved" | "save_failed">;
};

type GateStep = "pending" | "edit" | "code";
type GateStatus = "idle" | "sending" | "verifying";

// UI-only estimate matching Supabase Email OTP expiration.
// Supabase decides whether the OTP is valid.
const OTP_VALIDITY_MS = 300_000;
const OTP_RESEND_COOLDOWN_MS = 30_000;

export function LetterDownloadGate({
  open,
  purpose,
  pendingEmail = "",
  onClose,
  onVerified,
}: LetterDownloadGateProps) {
  const { t, lang } = useLocale();
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();
  const emailRef = useRef<HTMLInputElement>(null);
  const requestPending = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<GateStep>("pending");
  const [status, setStatus] = useState<GateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [codeExpiresAt, setCodeExpiresAt] = useState(0);
  const [, setTimerTick] = useState(0);
  const [choseOtherEmail, setChoseOtherEmail] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);
  const knownEmail = normalizeAuthEmail(pendingEmail ?? "");

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEmail(knownEmail ?? "");
      setCode("");
      setStep(knownEmail ? "pending" : "edit");
      setStatus("idle");
      setError(null);
      setResendAvailableAt(0);
      setCodeExpiresAt(0);
      setChoseOtherEmail(false);
      requestPending.current = false;
    }
  }

  if (open && !choseOtherEmail && knownEmail && email !== knownEmail && step !== "code") {
    setEmail(knownEmail);
    setStep("pending");
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const field = step === "code" ? codeRefs.current[0] : step === "edit" ? emailRef.current : null;
    field?.focus();
    field?.scrollIntoView({ block: "center" });
  }, [open, step]);

  useEffect(() => {
    if (!open || step !== "code" || Date.now() >= resendAvailableAt) return;
    const timer = window.setInterval(() => {
      setTimerTick((value) => value + 1);
      if (Date.now() >= resendAvailableAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, step, resendAvailableAt]);

  useEffect(() => {
    if (!open || step !== "code" || codeExpiresAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      setTimerTick((value) => value + 1);
      if (Date.now() >= codeExpiresAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, step, codeExpiresAt]);

  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const emailValid = normalizeAuthEmail(email) !== null;
  const busy = status !== "idle";
  const maskedEmail = maskEmail(email);
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
  const codeSecondsLeft = codeExpiresAt > 0
    ? Math.max(0, Math.ceil((codeExpiresAt - Date.now()) / 1000))
    : null;
  const codeTimeLeft = codeSecondsLeft === null ? null
    : `${String(Math.floor(codeSecondsLeft / 60)).padStart(2, "0")}:${String(codeSecondsLeft % 60).padStart(2, "0")}`;
  const titleKey = purpose === "letter-generation"
    ? "result.downloadGate.titleGeneration"
    : "result.downloadGate.title";
  const bodyKey = purpose === "letter"
    ? "result.downloadGate.bodyLetter"
    : purpose === "letter-generation"
      ? "result.downloadGate.bodyLetterGeneration"
      : "result.downloadGate.bodySeasonalPolaroid";
  const pendingSaveKey = purpose === "letter"
    ? "result.downloadGate.pendingSaveLetter"
    : purpose === "letter-generation"
      ? "result.downloadGate.pendingLetterGeneration"
      : "result.downloadGate.pendingSaveSeasonalPolaroid";

  const chooseOtherEmail = () => {
    setChoseOtherEmail(true);
    setStep("edit");
    setEmail("");
    setCode("");
    setError(null);
    setStatus("idle");
    setResendAvailableAt(0);
    setCodeExpiresAt(0);
  };

  const requestCode = async () => {
    if (requestPending.current) return;
    if (Date.now() < resendAvailableAt) {
      setError(t("result.downloadGate.resendWait"));
      return;
    }
    if (!emailValid) {
      setError(t("result.downloadGate.invalid"));
      return;
    }
    requestPending.current = true;
    setStatus("sending");
    setError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await requestLetterDownloadCode(client, {
        email,
        redirectTo: authCallbackUrl(
          window.location.origin,
          `${window.location.pathname}${window.location.search}`,
          lang,
        ),
        locale: lang,
      });
      if (result === "sent") {
        setStep("code");
        setStatus("idle");
        const now = Date.now();
        setResendAvailableAt(now + OTP_RESEND_COOLDOWN_MS);
        setCodeExpiresAt(now + OTP_VALIDITY_MS);
        return;
      }
      setStatus("idle");
      setError(result === "invalid_email"
        ? t("result.downloadGate.invalid")
        : t("result.downloadGate.sendFailed"));
    } catch (caught) {
      logAuthFailure("browser-client", caught);
      setStatus("idle");
      setError(t("result.downloadGate.unavailable"));
    } finally {
      requestPending.current = false;
    }
  };

  const verifyCode = async () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setStatus("verifying");
    setError(null);
    try {
      const client = createSupabaseBrowserAuthClient();
      const result = await verifyLetterDownloadCode(client, { email, code });
      if (result === "authenticated") {
        const saved = await onVerified();
        setStatus("idle");
        if (saved === "save_failed") setError(t("result.downloadGate.saveFailed"));
        return;
      }
      setStatus("idle");
      setError(result === "request_failed"
        ? t("result.downloadGate.sendFailed")
        : result === "expired"
          ? t("result.downloadGate.codeExpired")
          : t("result.downloadGate.codeInvalid"));
    } catch (caught) {
      logAuthFailure("browser-client", caught);
      setStatus("idle");
      setError(t("result.downloadGate.unavailable"));
    } finally {
      requestPending.current = false;
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[600] flex items-end justify-center bg-black/80 p-3 pb-[max(4.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-6"
          style={{ zIndex: 600 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
          data-letter-download-gate
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t("result.downloadGate.close")}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative z-[1] max-h-[min(92dvh,680px)] w-full max-w-[440px] overflow-y-auto rounded-3xl border border-[#C7A43A]/45 bg-[#100E0C] px-5 py-6 text-[#F3EAD8] shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:px-7 sm:py-7 ${bodyFont}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t("result.downloadGate.close")}
              className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-full border border-[#C7A43A]/35 text-xl leading-none text-[#D8B84C] transition hover:bg-[#D8B84C]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
            >
              ×
            </button>

            <h2 id={titleId} className="pr-10 text-[1.35rem] font-light leading-snug text-[#F6E7C1] sm:text-[1.55rem]">
              {t(titleKey)}
            </h2>
            <p className="mt-4 whitespace-pre-line text-[15px] font-extralight leading-[1.75] text-[#E7DCC8]">
              {step === "code"
                ? t("result.downloadGate.codeSentMasked").replace("%EMAIL%", maskedEmail)
                : t(bodyKey)}
            </p>
            {step === "pending" ? (
              <p className="mt-4 text-sm leading-relaxed text-[#D8B84C]">{maskedEmail}</p>
            ) : null}
            {step === "pending" ? (
              <p className="mt-3 text-sm font-extralight leading-relaxed text-[#E7DCC8]">
                {t(pendingSaveKey)}
              </p>
            ) : null}

            {step === "edit" ? (
              <form
                className="mt-6"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestCode();
                }}
              >
                <label htmlFor="letter-download-email" className="block text-sm text-[#F3EAD8]">
                  {t("result.downloadGate.emailLabel")}
                </label>
                <input
                  ref={emailRef}
                  id="letter-download-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  placeholder={t("result.downloadGate.emailPlaceholder")}
                  aria-invalid={error ? true : undefined}
                  className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3.5 text-base font-extralight text-[#F3EAD8] outline-none transition placeholder:text-[#8C8174] focus:border-[#D8B84C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] ${
                    error ? "border-amber-400/80" : "border-[#C7A43A]/40"
                  }`}
                />
                {error ? (
                  <p role="alert" className="mt-2 text-xs leading-relaxed text-amber-200">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-base font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {status === "sending" ? t("result.downloadGate.sending") : t("result.downloadGate.sendCode")}
                </button>
                <p className="mt-4 whitespace-pre-line text-xs font-extralight leading-relaxed text-[#A39888]">
                  {t("result.downloadGate.notice")}
                </p>
              </form>
            ) : null}

            {step === "pending" ? (
              <form
                className="mt-6"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestCode();
                }}
              >
                {error ? (
                  <p role="alert" className="mb-3 text-xs leading-relaxed text-amber-200">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-base font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {status === "sending" ? t("result.downloadGate.sending") : t("result.downloadGate.sendCode")}
                </button>
                <button
                  type="button"
                  onClick={chooseOtherEmail}
                  className="mt-3 min-h-11 w-full text-sm text-[#D8B84C] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
                >
                  {t("result.downloadGate.useOtherEmail")}
                </button>
              </form>
            ) : null}

            {step === "code" ? (
              <form
                className="mt-6"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode();
                }}
              >
                <div className="flex justify-between gap-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(node) => { codeRefs.current[index] = node; }}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={t("result.downloadGate.codeLabel")}
                      maxLength={1}
                      value={code[index] ?? ""}
                      disabled={busy}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "");
                        const next = (code.slice(0, index) + digits + code.slice(index + Math.max(digits.length, 1))).replace(/\D/g, "").slice(0, 6);
                        setCode(next);
                        setError(null);
                        const focusAt = Math.min(index + Math.max(digits.length, 1), 5);
                        if (digits) codeRefs.current[focusAt]?.focus();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Backspace" && !code[index] && index > 0) {
                          const next = code.slice(0, index - 1) + code.slice(index);
                          setCode(next);
                          codeRefs.current[index - 1]?.focus();
                        }
                      }}
                      onPaste={(event) => {
                        const digits = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                        if (!digits) return;
                        event.preventDefault();
                        setCode(digits);
                        setError(null);
                        codeRefs.current[Math.min(digits.length, 5)]?.focus();
                      }}
                      className={`h-12 w-11 rounded-xl border bg-black/40 text-center text-lg text-[#F3EAD8] outline-none focus:border-[#D8B84C] ${
                        error ? "border-amber-400/80" : "border-[#C7A43A]/40"
                      }`}
                    />
                  ))}
                </div>
                {codeTimeLeft !== null ? (
                  <p className="mt-3 text-center text-sm text-[#D8B84C]" aria-live="off">
                    {codeSecondsLeft === 0
                      ? t("result.downloadGate.codeExpired")
                      : t("result.downloadGate.codeExpiresIn").replace("%TIME%", codeTimeLeft)}
                  </p>
                ) : null}
                {error ? (
                  <p role="alert" className="mt-3 text-xs leading-relaxed text-amber-200">
                    {error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={busy || code.length < 6}
                  className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-base font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {status === "verifying" ? t("result.downloadGate.verifying") : t("result.downloadGate.confirmCode")}
                </button>
                <button
                  type="button"
                  disabled={busy || resendSeconds > 0}
                  onClick={() => void requestCode()}
                  className="mt-3 min-h-11 w-full text-sm text-[#D8B84C] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] disabled:opacity-55"
                >
                  {t("result.downloadGate.resendCode")}
                </button>
                <button
                  type="button"
                  onClick={chooseOtherEmail}
                  className="mt-1 min-h-11 w-full text-sm text-[#A39888] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
                >
                  {t("result.downloadGate.useOtherEmail")}
                </button>
              </form>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              className="mt-5 min-h-11 w-full text-sm text-[#E7DCC8] underline-offset-4 transition hover:text-[#F6E7C1] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
            >
              {t(
                purpose === "letter"
                  ? "result.downloadGate.dismissLetter"
                  : purpose === "letter-generation"
                    ? "result.downloadGate.dismissGeneration"
                    : "result.downloadGate.dismiss",
              )}
            </button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
