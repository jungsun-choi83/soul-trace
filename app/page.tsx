import { WelcomeExperience } from "@/components/welcome-experience";
import { PartnerEntryFallback } from "@/components/partner-entry-fallback";
import { PartnerEntryRedirect } from "@/components/partner-entry-redirect";
import { authEntryPath } from "@/lib/auth-redirect";
import { looksLikePartnerCode, PARTNER_CODE_PARAM, resolvePartnerCode } from "@/lib/partner";
import { partnerEntryDestination } from "@/lib/partner-entry";
import { hrefWithSearchParams, type ServerSearchParams } from "@/lib/search-params";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome | Soul Trace",
  description: "Begin your Soul Trace journey.",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const rawCode = params[PARTNER_CODE_PARAM];
  const candidate = Array.isArray(rawCode) ? rawCode[0] : rawCode;

  if (candidate !== undefined) {
    if (!looksLikePartnerCode(candidate)) return <PartnerEntryFallback />;

    const partnerClient = createSupabaseServerClient();
    const partner = partnerClient
      ? await resolvePartnerCode(partnerClient, candidate)
      : null;
    if (!partner) return <PartnerEntryFallback />;

    const authClient = await createSupabaseAuthServerClient();
    const { data } = authClient
      ? await authClient.auth.getUser()
      : { data: { user: null } };
    return (
      <PartnerEntryRedirect
        destination={partnerEntryDestination(partner.partnerType, partner.partnerCode, params)}
        authenticated={Boolean(data.user)}
      />
    );
  }

  const choiceHref = hrefWithSearchParams("/choose", params);

  return (
    <WelcomeExperience
      choiceHref={authEntryPath(choiceHref)}
    />
  );
}
