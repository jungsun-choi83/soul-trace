import { AuthEntry } from "@/components/auth-entry";
import {
  authenticatedAuthDestination,
  resolveAuthReturnPath,
} from "@/lib/auth-redirect";
import type { ServerSearchParams } from "@/lib/search-params";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Account | Soul Trace",
  description: "Continue to Soul Trace with your email.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const returnTo = resolveAuthReturnPath(params);
  const supabase = await createSupabaseAuthServerClient();
  const { data: userData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  const authenticatedDestination = authenticatedAuthDestination(
    Boolean(userData.user),
    returnTo,
  );
  if (authenticatedDestination) redirect(authenticatedDestination);

  const authError = Array.isArray(params.authError) ? params.authError[0] : params.authError;
  const passwordUpdated = params.passwordUpdated === "1";
  const initialAuthError = authError === "verification_failed"
    ? "invalid_link"
    : authError === "claim_failed"
      ? "request_failed"
      : null;

  return (
    <AuthEntry
      returnTo={returnTo}
      initialAuthError={initialAuthError}
      passwordUpdated={passwordUpdated}
    />
  );
}
