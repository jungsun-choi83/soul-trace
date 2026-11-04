import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "추가 제작 주문 확인" };

export default function CheckoutPreviewPage() {
  return (
    <FlowNote
      showTabs={false}
      tab="create"
      title="추가 제작 주문 확인"
      body="판매 준비 중이에요. 이 화면에서는 주문을 만들지 않고 결제창도 열지 않아요. 추가 1장과 3장 세트는 안내만 하며, 금액은 아직 정해지지 않았어요. 월 구독은 열리지 않았어요. 이미 만든 무료 결과는 그대로 저장할 수 있어요."
      links={[
        { href: "/polaroid", label: "무료 결과로 돌아가기" },
        { href: "/premium", label: "제작 안내" },
      ]}
    />
  );
}
