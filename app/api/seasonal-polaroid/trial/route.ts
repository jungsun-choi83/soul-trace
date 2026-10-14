import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import {
  seasonalPolaroidAccessAllowed,
  seasonalPolaroidDeveloperRequestAllowed,
} from "@/lib/seasonal-polaroid-access";
import {
  readSeasonalAccountTrial,
  seasonalPolaroidAccountIdentityHash,
  SEASONAL_POLAROID_ACCOUNT_TRIAL_LIMIT,
} from "@/lib/seasonal-polaroid-guest-trial";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!isSeasonalPolaroidEnabled() || !(await seasonalPolaroidAccessAllowed(request))) {
    return Response.json({ error: "seasonal_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (seasonalPolaroidDeveloperRequestAllowed(request)) {
    return Response.json(
      {
        limit: "unlimited",
        remaining: null,
        developer: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  const accountHash = user ? seasonalPolaroidAccountIdentityHash(user.id) : null;
  if (!accountHash) {
    return Response.json({ error: "authentication_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const state = await readSeasonalAccountTrial(accountHash);
  if (!state) {
    return Response.json({ error: "seasonal_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const response = Response.json(
    { limit: SEASONAL_POLAROID_ACCOUNT_TRIAL_LIMIT, remaining: state.remaining },
    { headers: { "Cache-Control": "no-store" } },
  );
  return response;
}
