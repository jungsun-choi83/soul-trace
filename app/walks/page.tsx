import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "산책 기록" };

export default function WalkHistoryPage() {
  return (
    <FlowNote
      lifeStatus="living"
      tab="context"
      title="산책 기록"
      body="목걸이와 휴대폰이 연결된 뒤에 기록이 남습니다. 지금은 걸음 수와 거리를 만들지 않습니다."
      links={[
        { href: "/walks/new", label: "산책 안내" },
        { href: "/my/device", label: "목걸이 홈" },
      ]}
    />
  );
}
