import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import {
  seasonalPolaroidAccessAllowed,
  seasonalPolaroidDeveloperRequestAllowed,
} from "@/lib/seasonal-polaroid-access";
import {
  readSeasonalGuestTrial,
  seasonalGuestIdentity,
  SEASONAL_POLAROID_GUEST_TRIAL_LIMIT,
} from "@/lib/seasonal-polaroid-guest-trial";

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
  const guest = seasonalGuestIdentity(request);
  if (!guest) {
    return Response.json({ error: "seasonal_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const state = await readSeasonalGuestTrial(guest.hash);
  if (!state) {
    return Response.json({ error: "seasonal_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const response = Response.json(
    { limit: SEASONAL_POLAROID_GUEST_TRIAL_LIMIT, remaining: state.remaining },
    { headers: { "Cache-Control": "no-store" } },
  );
  if (guest.setCookie) response.headers.append("Set-Cookie", guest.setCookie);
  return response;
}
