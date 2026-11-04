"use client";

import { SoulTraceSplash } from "@/components/SoulTraceSplash";

export function SplashScreen({
  fading = false,
  onDismiss,
}: {
  fading?: boolean;
  onDismiss?: () => void;
}) {
  return <SoulTraceSplash fading={fading} onDismiss={onDismiss} />;
}
