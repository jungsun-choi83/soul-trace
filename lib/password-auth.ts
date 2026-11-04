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
  };
};

export type PasswordAuthResult =
  | "authenticated"
  | "check_email"
  | "invalid_email"
  | "already_registered"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "policy_failed"
  | "request_failed";

function errorCode(error: AuthFailure): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

export type PasswordSignupProvision = (input: {
  email: string;
  password: string;
  locale: unknown;
}) => Promise<"created" | "already_registered" | "policy_failed" | "unavailable">;

export async function completePasswordSignupOnServer(input: {
  email: string;
  password: string;
  locale: unknown;
}): Promise<"created" | "already_registered" | "policy_failed" | "unavailable"> {
  try {
    const response = await fetch("/api/auth/password-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        locale: normalizeAuthLocale(input.locale),
      }),
    });
    if (response.ok) return "created";
    if (response.status === 409) return "already_registered";
    if (response.status === 503) return "unavailable";
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    return payload?.error === "policy_failed" ? "policy_failed" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function createPasswordAccount(
  client: MainPasswordAuthClient,
  input: {
    email: string;
    password: string;
    redirectTo: string;
    locale: unknown;
    provision?: PasswordSignupProvision;
  },
): Promise<PasswordAuthResult> {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email";

  if (input.provision) {
    const provisioned = await input.provision({ email, password: input.password, locale: input.locale });
    if (provisioned === "already_registered") return "already_registered";
    if (provisioned === "policy_failed") return "policy_failed";
    if (provisioned === "created") {
      const signedIn = await signInWithPassword(client, { email, password: input.password });
      return signedIn === "email_not_confirmed" ? "request_failed" : signedIn;
    }
  }

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
  if (data.session) return "authenticated";

  const signedIn = await signInWithPassword(client, { email, password: input.password });
  return signedIn === "authenticated" ? "authenticated" : "check_email";
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
