import { logAuthFailure } from "./auth-diagnostics.ts";
import {
  normalizeAuthEmail,
  requestPasswordlessEmail,
  type PasswordlessAuthClient,
} from "./passwordless-auth.ts";

export type LetterDownloadCodeClient = PasswordlessAuthClient & {
  auth: PasswordlessAuthClient["auth"] & {
    verifyOtp: (input: {
      email: string;
      token: string;
      type: "email";
    }) => Promise<{ data?: { session?: unknown | null }; error: unknown | null }>;
  };
};

const VERIFICATION_CODE_PATTERN = /^\d{6,8}$/;

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const record = error as { code?: unknown; message?: unknown };
  return `${typeof record.code === "string" ? record.code : ""} ${typeof record.message === "string" ? record.message : ""}`.toLowerCase();
}

export async function requestLetterDownloadCode(
  client: LetterDownloadCodeClient,
  input: { email: string; redirectTo: string; locale: unknown },
): Promise<"sent" | "invalid_email" | "request_failed"> {
  return requestPasswordlessEmail(client, {
    email: input.email,
    mode: "signup",
    redirectTo: input.redirectTo,
    locale: input.locale,
  });
}

export async function verifyLetterDownloadCode(
  client: LetterDownloadCodeClient,
  input: { email: string; code: string },
): Promise<"authenticated" | "invalid_email" | "invalid_code" | "expired" | "request_failed"> {
  const email = normalizeAuthEmail(input.email);
  const token = input.code.trim();
  if (!email) return "invalid_email";
  if (!VERIFICATION_CODE_PATTERN.test(token)) return "invalid_code";

  try {
    const { data, error } = await client.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error || !data?.session) {
      return /expired/.test(errorText(error)) ? "expired" : "invalid_code";
    }
  } catch (error) {
    logAuthFailure("callback-otp-verification", error);
    return "request_failed";
  }

  return "authenticated";
}
