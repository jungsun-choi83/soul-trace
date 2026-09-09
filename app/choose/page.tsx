import { ModeChoice } from "@/components/mode-choice";
import { letterModePath } from "@/lib/letter-mode";
import {
  PARTNER_CODE_PARAM,
  looksLikePartnerCode,
  resolvePartnerCode,
} from "@/lib/partner";
import type { ServerSearchParams } from "@/lib/search-params";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

export default async function ModeChoicePage({
  searchParams,
}: {
  searchParams: Promise<ServerSearchParams>;
}) {
  const params = await searchParams;
  const raw = params[PARTNER_CODE_PARAM];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const code = looksLikePartnerCode(candidate) ? candidate : null;
  const preservedParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === PARTNER_CODE_PARAM) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => preservedParams.append(key, item));
    } else if (value !== undefined) {
      preservedParams.append(key, value);
    }
  }
  if (code) preservedParams.set(PARTNER_CODE_PARAM, code);
  const preservedQuery = preservedParams.toString();

  if (!code) return <ModeChoice partnerCode={null} preservedQuery={preservedQuery} />;

  const supabase = createSupabaseServerClient();
  const partner = supabase ? await resolvePartnerCode(supabase, code) : null;

  if (partner?.partnerTrack) {
    redirect(
      `${letterModePath(partner.partnerTrack)}?${PARTNER_CODE_PARAM}=${encodeURIComponent(code)}`,
    );
  }

  return <ModeChoice partnerCode={code} preservedQuery={preservedQuery} />;
}
