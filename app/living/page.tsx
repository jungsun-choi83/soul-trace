import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { parseServiceChannel } from "@/lib/service-channel";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ETERNAL_BEAM_ACCESS_COOKIE, verifyEternalBeamAccessSession } from "@/lib/eternal-beam-access";

export const metadata: Metadata = {
  title: "지금 곁에 있는 아이, 오늘의 편지",
  description: "오늘 하루 아이가 무슨 생각을 했는지, 아이의 목소리로 들어보세요.",
  alternates: { canonical: "/living" },
};

export default async function LivingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialServiceChannel = parseServiceChannel(params.ch);
  const initialPetId = typeof params.petId === "string" ? params.petId : null;
  const cookieStore = await cookies();
  const hasEternalBeamAccess = await verifyEternalBeamAccessSession(cookieStore.get(ETERNAL_BEAM_ACCESS_COOKIE)?.value);

  return <SoulTraceFlow mode="living" initialServiceChannel={initialServiceChannel} initialPetId={initialPetId} hasEternalBeamAccess={hasEternalBeamAccess} />;
}
