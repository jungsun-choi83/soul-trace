import type { Metadata } from "next";

import { SharedLetterView } from "@/components/shared-letter-view";
import { loadSharedLetter } from "@/lib/letter-share";
import { noIndexRobots } from "@/lib/site-url";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "A Soul Trace letter",
  description: "A letter shared through Soul Trace.",
  robots: noIndexRobots,
};

export default async function SharedLetterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const letter = await loadSharedLetter(token);
  return <SharedLetterView letter={letter} />;
}
