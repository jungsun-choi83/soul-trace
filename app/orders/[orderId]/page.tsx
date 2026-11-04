import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "결제 상태" };

export default function OrderStatusPage() {
  return (
    <FlowNote
      showTabs={false}
      tab="create"
      title="결제 상태"
      body="이 주소만으로 결제가 승인되지 않아요. 서버 확인 전의 주문은 제작권으로 바뀌지 않고, 무료 결과와 원본 사진은 그대로예요."
      links={[
        { href: "/orders", label: "결제 상태" },
        { href: "/polaroid", label: "무료 결과로 돌아가기" },
      ]}
    />
  );
}
