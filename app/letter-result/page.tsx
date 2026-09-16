import { PersistentLetterUnavailable } from "@/components/persistent-letter-unavailable";
import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { loadPersistentLetterResult } from "@/lib/persistent-letter-result";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ETERNAL_BEAM_ACCESS_COOKIE, verifyEternalBeamAccessSession } from "@/lib/eternal-beam-access";

export const metadata: Metadata = {
  title: "Your Letter | Soul Trace",
  description: "Your saved Soul Trace letter.",
};

export default async function LetterResultPage() {
  const saved = await loadPersistentLetterResult();
  if (!saved) return <PersistentLetterUnavailable />;
  const cookieStore = await cookies();
  const hasEternalBeamAccess = await verifyEternalBeamAccessSession(cookieStore.get(ETERNAL_BEAM_ACCESS_COOKIE)?.value);
  return <SoulTraceFlow mode={saved.mode} initialResult={saved.result} hasEternalBeamAccess={hasEternalBeamAccess} />;
}
