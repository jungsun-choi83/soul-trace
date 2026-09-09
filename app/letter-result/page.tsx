import { PersistentLetterUnavailable } from "@/components/persistent-letter-unavailable";
import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { loadPersistentLetterResult } from "@/lib/persistent-letter-result";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Letter | Soul Trace",
  description: "Your saved Soul Trace letter.",
};

export default async function LetterResultPage() {
  const saved = await loadPersistentLetterResult();
  if (!saved) return <PersistentLetterUnavailable />;
  return <SoulTraceFlow mode={saved.mode} initialResult={saved.result} />;
}
