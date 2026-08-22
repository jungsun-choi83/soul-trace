import { SoulTraceFlow } from "@/components/soul-trace-flow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soul Trace | 지금 곁에 있는 아이",
  description: "오늘 하루 아이가 무슨 생각을 했는지, 아이의 목소리로 들어보세요.",
};

export default function LivingPage() {
  return <SoulTraceFlow mode="living" />;
}
