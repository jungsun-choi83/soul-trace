"use client";

import { partnerEntryPath } from "@/lib/partner-entry";
import { useEffect } from "react";

export function PartnerEntryRedirect({
  destination,
  authenticated,
}: {
  destination: string;
  authenticated: boolean;
}) {
  useEffect(() => {
    window.location.replace(
      partnerEntryPath(destination, authenticated, window.location.hash),
    );
  }, [authenticated, destination]);

  return <main className="min-h-screen bg-black" aria-busy="true" />;
}
