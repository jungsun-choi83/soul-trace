import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "산책 안내" };

export default function WalkStartPage() {
  return (
    <FlowNote
      lifeStatus="living"
      tab="context"
      title="산책 안내"
      body="산책을 시작해도 위치나 걸음 수가 기록되지 않습니다. 기기 연결 이후의 측정만 기록으로 남깁니다."
      links={[{ href: "/walks", label: "산책 기록" }]}
    />
  );
}
