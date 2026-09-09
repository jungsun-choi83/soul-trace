import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const LETTER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeReturnPath(value: string): string {
  return value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/life-archive";
}

/**
 * Phase 3 can call this after the current result identifies its saved letter.
 * The browser never needs to submit or receive the owner's email address.
 */
export async function requestLetterOwnerVerification(
  letterId: string,
  siteOrigin: string,
  returnPath = "/life-archive",
): Promise<void> {
  if (!LETTER_ID_PATTERN.test(letterId)) {
    throw new Error("Unable to verify this letter.");
  }

  const admin = createSupabaseServerClient();
  const publicConfig = getPublicSupabaseConfig();
  if (!admin || !publicConfig) {
    throw new Error("Owner verification is not configured.");
  }

  const { data, error } = await admin
    .from("soul_trace_profiles")
    .select("user_email")
    .eq("letter_id", letterId)
    .maybeSingle();

  if (error || !data?.user_email) {
    throw new Error("Unable to verify this letter.");
  }

  const authClient = createClient(publicConfig.url, publicConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const callback = new URL("/auth/confirm", siteOrigin);
  callback.searchParams.set("next", safeReturnPath(returnPath));

  const { error: signInError } = await authClient.auth.signInWithOtp({
    email: data.user_email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
    },
  });

  if (signInError) {
    throw new Error("Unable to send the verification email.");
  }
}
