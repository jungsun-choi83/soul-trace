import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { parseServiceChannel } from "@/lib/service-channel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soul Trace | 무지개 다리를 건넌 아이",
  description: "아이가 마지막으로 전하지 못한 말을, 아이의 목소리로 전해 드려요.",
};

export default async function MemorialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const initialServiceChannel = parseServiceChannel(params.ch);
  const initialPetId = typeof params.petId === "string" ? params.petId : null;

  return <SoulTraceFlow mode="memorial" initialServiceChannel={initialServiceChannel} initialPetId={initialPetId} />;
}
