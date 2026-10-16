import type { ServiceChannel } from "./service-channel.ts";

const SERVICE_CHANNEL_BACKGROUNDS: Readonly<Record<ServiceChannel, string>> = {
  pension: "/images/channel-backgrounds/pension-bg.webp",
  grooming: "/images/channel-backgrounds/grooming-bg.webp",
  hospital: "/images/channel-backgrounds/hospital-bg.webp",
  funeral: "/images/channel-backgrounds/memorial-bg.webp",
};

export function serviceChannelBackground(
  channel: ServiceChannel | null | undefined,
): string | null {
  return channel ? SERVICE_CHANNEL_BACKGROUNDS[channel] : null;
}
