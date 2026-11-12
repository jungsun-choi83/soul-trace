import { normalizeAuthEmail, normalizeAuthLocale, type AuthLocale } from "./passwordless-auth.ts";
import { logAuthFailure } from "./auth-diagnostics.ts";

type AuthFailure = { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;

export type MainPasswordAuthClient = {
  auth: {
    signUp: (input: {
      email: string;
      password: string;
      options: { emailRedirectTo: string; data: { locale: AuthLocale } };
    }) => Promise<{ data: { session: unknown | null }; error: AuthFailure }>;
    signInWithPassword: (input: {
      email: string;
      password: string;
    }) => Promise<{ data: { session: unknown | null }; error: AuthFailure }>;
    verifyOtp: (input: {
      email: string;
      token: string;
      type: "email";
    }) => Promise<{ data: { session: unknown | null }; error: AuthFailure }>;
    resend: (input: {
      type: "signup";
      email: string;
      options: { emailRedirectTo: string };
    }) => Promise<{ error: AuthFailure }>;
    signOut: (options: { scope: "local" }) => Promise<{ error: AuthFailure }>;
  };
};

export type PasswordAuthResult =
  | "authenticated"
  | "check_email"
  | "invalid_email"
  | "already_registered"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "confirmation_unavailable"
  | "policy_failed"
  | "request_failed";

function errorCode(error: AuthFailure): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

export async function createPasswordAccount(
  client: MainPasswordAuthClient,
  input: {
    email: string;
    password: string;
    redirectTo: string;
    locale: unknown;
  },
): Promise<PasswordAuthResult> {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email";

  const { data, error } = await client.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
      data: { locale: normalizeAuthLocale(input.locale) },
    },
  });
  if (error) {
    logAuthFailure("signup", error);
    const code = errorCode(error);
    if (code === "user_already_exists" || code === "email_exists") {
      return "already_registered";
    }
    return code === "weak_password" ? "policy_failed" : "request_failed";
  }
  if (data.session) {
    const { error: signOutError } = await client.auth.signOut({ scope: "local" });
    if (signOutError) logAuthFailure("signup", signOutError);
    return "confirmation_unavailable";
  }
  return "check_email";
}

export type SignupOtpResult = "authenticated" | "invalid_email" | "invalid_code" | "expired" | "request_failed";

export async function verifyPasswordSignupOtp(
  client: MainPasswordAuthClient,
  input: { email: string; code: string },
): Promise<SignupOtpResult> {
  const email = normalizeAuthEmail(input.email);
  const token = input.code.trim();
  if (!email) return "invalid_email";
  if (!/^\d{6,8}$/.test(token)) return "invalid_code";

  try {
    const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
    if (!error && data.session) return "authenticated";
    const details = error && typeof error === "object"
      ? `${"code" in error ? String(error.code) : ""} ${"message" in error ? String(error.message) : ""}`
      : "";
    return /expired|otp_expired/i.test(details) ? "expired" : "invalid_code";
  } catch (error) {
    logAuthFailure("callback-otp-verification", error);
    return "request_failed";
  }
}

export async function resendPasswordSignupOtp(
  client: MainPasswordAuthClient,
  input: { email: string; redirectTo: string },
): Promise<"sent" | "invalid_email" | "request_failed"> {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email";
  try {
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: input.redirectTo },
    });
    if (error) {
      logAuthFailure("signup", error);
      return "request_failed";
    }
    return "sent";
  } catch (error) {
    logAuthFailure("signup", error);
    return "request_failed";
  }
}

export async function signInWithPassword(
  client: MainPasswordAuthClient,
  input: { email: string; password: string },
): Promise<PasswordAuthResult> {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email";

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) {
    logAuthFailure("signin", error);
    return errorCode(error) === "email_not_confirmed"
      ? "email_not_confirmed"
      : "invalid_credentials";
  }
  return data.session ? "authenticated" : "request_failed";
}
