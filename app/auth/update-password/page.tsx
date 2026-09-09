import { PasswordUpdateForm } from "@/components/password-update-form";
import { safeAuthReturnPath } from "@/lib/auth-redirect";
import type { ServerSearchParams } from "@/lib/search-params";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { redirect } from "next/navigation";

export default async function UpdatePasswordPage({ searchParams }: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const rawReturnTo = params.returnTo;
  const returnTo = safeAuthReturnPath(Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo);
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    const destination = new URL("https://soul-trace.invalid/auth");
    destination.searchParams.set("returnTo", returnTo);
    destination.searchParams.set("authError", "verification_failed");
    redirect(`${destination.pathname}${destination.search}`);
  }
  return <PasswordUpdateForm returnTo={returnTo} />;
}
