import { normalizeAuthEmail } from "./passwordless-auth.ts";

export const MIN_PASSWORD_LENGTH = 8;

export type RecoveryClient = {
  auth: {
    resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: unknown | null }>;
  };
};

export type PasswordUpdateClient = {
  auth: {
    updateUser: (attributes: { password: string }) => Promise<{ error: unknown | null }>;
    signOut: (options: { scope: "local" }) => Promise<{ error: unknown | null }>;
  };
};

export function passwordValidationError(password: string, confirmation: string) {
  if (!password) return "required" as const;
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short" as const;
  if (password !== confirmation) return "mismatch" as const;
  return null;
}

export async function requestPasswordRecovery(client: RecoveryClient, input: {
  email: string;
  redirectTo: string;
}) {
  const email = normalizeAuthEmail(input.email);
  if (!email) return "invalid_email" as const;
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: input.redirectTo });
  return error ? "request_failed" as const : "sent" as const;
}

export async function updateRecoveryPassword(client: PasswordUpdateClient, password: string) {
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
    return code === "weak_password" ? "policy_failed" as const : "request_failed" as const;
  }
  await client.auth.signOut({ scope: "local" });
  return "updated" as const;
}
