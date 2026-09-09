export type AuthMode = "signup" | "signin";
export type AuthLocale = "en" | "ko";

export const AUTH_LOCALE_COOKIE = "soul-trace-locale";

export function normalizeAuthLocale(value: unknown): AuthLocale {
  return value === "ko" ? "ko" : "en";
}

export type PasswordlessAuthClient = {
  auth: {
    signInWithOtp: (input: {
      email: string;
      options: {
        emailRedirectTo: string;
        shouldCreateUser: boolean;
        data?: { locale: AuthLocale };
      };
    }) => Promise<{ error: unknown | null }>;
  };
};

export function normalizeAuthEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function requestPasswordlessEmail(
  client: PasswordlessAuthClient,
  input: { email: string; mode: AuthMode; redirectTo: string; locale: unknown },
): Promise<"sent" | "invalid_email" | "request_failed"> {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email";
  const locale = normalizeAuthLocale(input.locale);
  const shouldCreateUser = input.mode === "signup";

  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: input.redirectTo,
      shouldCreateUser,
      ...(shouldCreateUser ? { data: { locale } } : {}),
    },
  });
  return error ? "request_failed" : "sent";
}
