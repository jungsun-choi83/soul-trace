"use client";

import { useLocale } from "@/components/locale-provider";
import { authCallbackUrl } from "@/lib/auth-redirect";
import { logAuthFailure } from "@/lib/auth-diagnostics";
import {
  requestLetterDownloadCode,
  verifyLetterDownloadCode,
} from "@/lib/letter-download-auth";
import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { createSupabaseBrowserAuthClient } from "@/lib/supabase-auth-browser";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";

type LetterDownloadGateProps = {
  open: boolean;
  initialEmail: string;
  onClose: () => void;
  onVerified: () => void;
};

type GateStep = "email" | "code";
type GateStatus = "idle" | "sending" | "verifying";

export function LetterDownloadGate({
  open,
  initialEmail,
  onClose,
  onVerified,
}: LetterDownloadGateProps) {
  const { t, lang } = useLocale();
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const requestPending = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<GateStep>("email");
  const [status, setStatus] = useState<GateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setEmail(initialEmail);
      setCode("");
      setStep("email");
      setStatus("idle");
      setError(null);
      requestPending.current = false;
    }
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
    const field = step === "code" ? codeRef.current : emailRef.current;
    field?.focus();
  }, [open, step]);

  const bodyFont = lang === "ko" ? "font-ko break-keep" : "font-display-en";
  const emailValid = normalizeAuthEmail(email) !== null;
  const busy = status !== "idle";

  const requestCode = async () => {
    if (requestPending.current) return;
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
        setStatus("idle");
        onVerified();
        return;
      }
      setStatus("idle");
      setError(result === "request_failed"
        ? t("result.downloadGate.sendFailed")
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
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-6"
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
              {t("result.downloadGate.title")}
            </h2>
            <p className="mt-4 whitespace-pre-line text-[15px] font-extralight leading-[1.75] text-[#E7DCC8]">
              {step === "email" ? t("result.downloadGate.body") : t("result.downloadGate.codeSent")}
            </p>

            {step === "email" ? (
              <form
                className="mt-6"
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
                  className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-base font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {status === "sending" ? t("result.downloadGate.sending") : t("result.downloadGate.sendCode")}
                </button>
              </form>
            ) : (
              <form
                className="mt-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  void verifyCode();
                }}
              >
                <p className="text-sm text-[#D8B84C]">{normalizeAuthEmail(email)}</p>
                <label htmlFor="letter-download-code" className="mt-4 block text-sm text-[#F3EAD8]">
                  {t("result.downloadGate.codeLabel")}
                </label>
                <input
                  ref={codeRef}
                  id="letter-download-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 8));
                    setError(null);
                  }}
                  placeholder={t("result.downloadGate.codePlaceholder")}
                  aria-invalid={error ? true : undefined}
                  className={`mt-2 w-full rounded-xl border bg-black/40 px-4 py-3.5 text-base tracking-[0.28em] text-[#F3EAD8] outline-none transition placeholder:tracking-normal placeholder:text-[#8C8174] focus:border-[#D8B84C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] ${
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
                  className="mt-4 flex min-h-[52px] w-full items-center justify-center rounded-xl bg-[#C7A43A] px-5 py-3 text-base font-medium text-[#0B0A08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:bg-[#D4B34A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5C761] active:bg-[#B28F2E] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {status === "verifying" ? t("result.downloadGate.verifying") : t("result.downloadGate.confirmCode")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void requestCode()}
                  className="mt-3 min-h-11 w-full text-sm text-[#D8B84C] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C] disabled:opacity-55"
                >
                  {t("result.downloadGate.resendCode")}
                </button>
              </form>
            )}

            <p className="mt-4 whitespace-pre-line text-xs font-extralight leading-relaxed text-[#A39888]">
              {t("result.downloadGate.notice")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 min-h-11 w-full text-sm text-[#E7DCC8] underline-offset-4 transition hover:text-[#F6E7C1] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B84C]"
            >
              {t("result.downloadGate.dismiss")}
            </button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
