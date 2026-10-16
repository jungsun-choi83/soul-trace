"use client";

import { useEffect } from "react";

export function PartnerEntryRedirect({
  destination,
}: {
  destination: string;
}) {
  useEffect(() => {
    // FUTURE AUTH FEATURE
    // Keep /auth and partnerEntryPath for future Sign Up / Sign In implementation.
    // Authentication is not part of the current SoulTrace questionnaire flow.
    window.location.replace(`${destination}${window.location.hash}`);
  }, [destination]);

  return <main className="min-h-screen bg-black" aria-busy="true" />;
}
