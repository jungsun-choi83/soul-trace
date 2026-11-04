import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "결제 상태" };

export default function OrdersPreviewPage() {
  return (
    <FlowNote
      showTabs={false}
      tab="create"
      title="결제 상태"
      body="서버에서 승인한 주문이 없어요. 이 화면은 결제 성공이 아니고, 제작권을 지급하지 않아요. 무료로 만든 결과와 원본 사진은 그대로예요."
      links={[
        { href: "/polaroid", label: "무료 결과로 돌아가기" },
        { href: "/checkout", label: "주문 안내" },
      ]}
    />
  );
}
