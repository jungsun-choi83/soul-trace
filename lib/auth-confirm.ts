import type { EmailOtpType } from "@supabase/supabase-js";

export type AuthConfirmationClient = {
  auth: {
    exchangeCodeForSession: (code: string) => Promise<{ error: unknown | null }>;
    verifyOtp: (input: {
      token_hash: string;
      type: EmailOtpType;
    }) => Promise<{ error: unknown | null }>;
    signOut: () => Promise<unknown>;
  };
  rpc: (name: string) => PromiseLike<{ error: unknown | null }>;
};

export type AuthConfirmationResult =
  | "authenticated"
  | "verification_failed"
  | "claim_failed";

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

  if (code) {
    ({ error: authenticationError } = await supabase.auth.exchangeCodeForSession(code));
  } else if (input.tokenHash && input.type) {
    ({ error: authenticationError } = await supabase.auth.verifyOtp({
      token_hash: input.tokenHash,
      type: input.type,
    }));
  } else {
    return "verification_failed";
  }

  if (authenticationError) return "verification_failed";

  const { error: claimError } = await supabase.rpc(
    "claim_soul_trace_legacy_records",
  );

  if (claimError) {
    await supabase.auth.signOut();
    return "claim_failed";
  }

  return "authenticated";
}
