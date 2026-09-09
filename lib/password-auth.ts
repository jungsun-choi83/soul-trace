import { normalizeAuthEmail, normalizeAuthLocale, type AuthLocale } from "./passwordless-auth.ts";

type AuthFailure = { code?: unknown } | null;

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
  | "invalid_credentials"
  | "email_not_confirmed"
  | "policy_failed"
  | "request_failed";

function errorCode(error: AuthFailure): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

export async function createPasswordAccount(
  client: MainPasswordAuthClient,
  input: { email: string; password: string; redirectTo: string; locale: unknown },
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
    return errorCode(error) === "weak_password" ? "policy_failed" : "request_failed";
  }
  return data.session ? "authenticated" : "check_email";
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
    return errorCode(error) === "email_not_confirmed"
      ? "email_not_confirmed"
      : "invalid_credentials";
  }
  return data.session ? "authenticated" : "request_failed";
}
