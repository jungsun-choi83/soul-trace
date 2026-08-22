import { SoulTraceFlow } from "@/components/soul-trace-flow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soul Trace | 무지개 다리를 건넌 아이",
  description: "아이가 마지막으로 전하지 못한 말을, 아이의 목소리로 전해 드려요.",
};

export default function MemorialPage() {
  return <SoulTraceFlow mode="memorial" />;
}
