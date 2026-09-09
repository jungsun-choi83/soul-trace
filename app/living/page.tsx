import { SoulTraceFlow } from "@/components/soul-trace-flow";
import { parseServiceChannel } from "@/lib/service-channel";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soul Trace | 지금 곁에 있는 아이",
  description: "오늘 하루 아이가 무슨 생각을 했는지, 아이의 목소리로 들어보세요.",
};

export default async function LivingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const initialServiceChannel = parseServiceChannel((await searchParams).ch);

  return <SoulTraceFlow mode="living" initialServiceChannel={initialServiceChannel} />;
}
