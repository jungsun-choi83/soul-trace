import { authEntryPath } from "./auth-redirect.ts";
import { PARTNER_CODE_PARAM, type PartnerType } from "./partner.ts";
import type { ServerSearchParams } from "./search-params.ts";
import { partnerTypeToServiceChannel, serviceChannelMode } from "./service-channel.ts";
import { letterModePath } from "./letter-mode.ts";

/** Builds the server-trusted destination for a partner QR entry. */
export function partnerEntryDestination(
  partnerType: PartnerType,
  partnerCode: string,
  params: ServerSearchParams,
): string {
  const channel = partnerTypeToServiceChannel(partnerType);
  const destination = new URLSearchParams();
  destination.set(PARTNER_CODE_PARAM, partnerCode);
  destination.set("ch", channel);

  for (const [key, value] of Object.entries(params)) {
    if (key === PARTNER_CODE_PARAM || key === "ch") continue;
    const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
    for (const item of values) destination.append(key, item);
  }

  return `${letterModePath(serviceChannelMode(channel))}?${destination.toString()}`;
}

/** Adds a browser-only fragment, then selects the authenticated or auth-gated route. */
export function partnerEntryPath(
  destination: string,
  authenticated: boolean,
  fragment = "",
): string {
  const destinationWithFragment = fragment.startsWith("#")
    ? `${destination}${fragment}`
    : destination;
  return authenticated
    ? destinationWithFragment
    : authEntryPath(destinationWithFragment);
}
