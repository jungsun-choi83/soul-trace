import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { parseServiceChannel } from "@/lib/service-channel";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ETERNAL_BEAM_ACCESS_COOKIE, verifyEternalBeamAccessSession } from "@/lib/eternal-beam-access";

export const metadata: Metadata = {
  title: "무지개 다리 너머로 전하는 편지",
  description: "아이가 마지막으로 전하지 못한 말을, 아이의 목소리로 전해 드려요.",
  alternates: { canonical: "/memorial" },
};

export default async function MemorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialServiceChannel = parseServiceChannel(params.ch);
  const initialPetId = typeof params.petId === "string" ? params.petId : null;
  const cookieStore = await cookies();
  const hasEternalBeamAccess = await verifyEternalBeamAccessSession(cookieStore.get(ETERNAL_BEAM_ACCESS_COOKIE)?.value);

  return <SoulTraceFlow mode="memorial" initialServiceChannel={initialServiceChannel} initialPetId={initialPetId} hasEternalBeamAccess={hasEternalBeamAccess} />;
}
