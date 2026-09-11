import type { LetterMode } from "./letter-mode.ts";
import type { PartnerType } from "./partner.ts";

/** Optional service context supplied by a partner or campaign URL. */
export type ServiceChannel = "pension" | "grooming" | "hospital" | "funeral";
export type CustomizedServiceChannel = Exclude<ServiceChannel, "funeral">;

export const SERVICE_CHANNELS: readonly ServiceChannel[] = [
  "pension",
  "grooming",
  "hospital",
  "funeral",
];

const SERVICE_CHANNEL_MODES: Readonly<Record<ServiceChannel, LetterMode>> = {
  pension: "living",
  grooming: "living",
  hospital: "living",
  funeral: "memorial",
};

/** Partner type on the QR’s partner row → survey/channel for that visit. */
const PARTNER_TYPE_CHANNELS: Readonly<Record<PartnerType, ServiceChannel>> = {
  PENSION: "pension",
  GROOMING: "grooming",
  HOSPITAL: "hospital",
  FUNERAL: "funeral",
};

/** Maps Ops partner type to the Soul Trace `ch=` service channel. */
export function partnerTypeToServiceChannel(type: PartnerType): ServiceChannel {
  return PARTNER_TYPE_CHANNELS[type];
}

/** Strictly parses an unknown value; missing, empty, and unsupported values return null. */
export function parseServiceChannel(value: unknown): ServiceChannel | null {
  return typeof value === "string" && SERVICE_CHANNELS.includes(value as ServiceChannel)
    ? (value as ServiceChannel)
    : null;
}

export function serviceChannelMode(channel: ServiceChannel): LetterMode {
  return SERVICE_CHANNEL_MODES[channel];
}

export function isServiceChannelCompatible(
  channel: ServiceChannel,
  mode: LetterMode,
): boolean {
  return serviceChannelMode(channel) === mode;
}

/** Funeral is retained only as a legacy routing alias for the normal memorial flow. */
export function isCustomizedServiceChannel(
  channel: ServiceChannel | null | undefined,
): channel is CustomizedServiceChannel {
  return channel === "pension" || channel === "grooming" || channel === "hospital";
}
