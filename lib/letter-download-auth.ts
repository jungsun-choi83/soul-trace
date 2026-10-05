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
  rpc: (name: "claim_soul_trace_legacy_records") => PromiseLike<{ error: unknown | null }>;
};

const VERIFICATION_CODE_PATTERN = /^\d{6,8}$/;

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
): Promise<"authenticated" | "invalid_email" | "invalid_code" | "request_failed"> {
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
    if (error || !data?.session) return "invalid_code";
  } catch (error) {
    logAuthFailure("callback-otp-verification", error);
    return "request_failed";
  }

  try {
    const claim = await client.rpc("claim_soul_trace_legacy_records");
    if (claim.error) logAuthFailure("callback-legacy-claim", claim.error);
  } catch (error) {
    logAuthFailure("callback-legacy-claim", error);
  }

  return "authenticated";
}
