import type { EmailOtpType } from "@supabase/supabase-js";
import { logAuthFailure } from "./auth-diagnostics.ts";

export type AuthConfirmationClient = {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{
      data?: { session?: unknown | null };
      error: unknown | null;
    }>;
    verifyOtp: (input: {
      token_hash: string;
      type: EmailOtpType;
    }) => Promise<{
      data?: { session?: unknown | null };
      error: unknown | null;
    }>;
  };
  rpc: (name: string) => PromiseLike<{ error: unknown | null }>;
};

export type AuthConfirmationResult =
  | "authenticated"
  | "verification_failed";

export async function authenticateAuthCallback(
  supabase: AuthConfirmationClient,
  input: {
    code: string | null;
    tokenHash: string | null;
    type: EmailOtpType | null;
  },
): Promise<AuthConfirmationResult> {
  const code = input.code?.trim();
  let authenticationError: unknown | null;
  let session: unknown | null | undefined;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    authenticationError = result.error;
    session = result.data?.session;
  } else if (input.tokenHash && input.type) {
    const result = await supabase.auth.verifyOtp({
      token_hash: input.tokenHash,
      type: input.type,
    });
    authenticationError = result.error;
    session = result.data?.session;
  } else {
    return "verification_failed";
  }

  if (authenticationError || !session) {
    logAuthFailure(
      code ? "callback-code-exchange" : "callback-otp-verification",
      authenticationError,
    );
    return "verification_failed";
  }

  const { error: claimError } = await supabase.rpc(
    "claim_soul_trace_legacy_records",
  );

  if (claimError) {
    logAuthFailure("callback-legacy-claim", claimError);
  }

  return "authenticated";
}
