"use client";

import { useEffect } from "react";

const PENDING_TRIAL_KEY = "soul-trace-free-trial-pending-v1";

export function ClearPendingFreeTrial({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    try {
      sessionStorage.removeItem(PENDING_TRIAL_KEY);
    } catch {
      // Storage can be disabled by browser privacy settings.
    }
  }, [active]);
  return null;
}
