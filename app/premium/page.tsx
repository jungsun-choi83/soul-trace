import { FlowNote } from "@/components/flow-note";
import { POSE_ART } from "@/lib/pose-art";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "유료 제작 안내" };

export default function PremiumPreviewPage() {
  return (
    <FlowNote
      art={POSE_ART.shibaAutumn}
      tab="create"
      title="추가 제작 안내"
      body="판매 준비 중이에요. 무료로 만든 폴라로이드는 그대로 저장하고 받을 수 있어요. 다른 스타일 추가 1장과 3장 세트는 아직 결제하지 않으며, 월 구독은 열리지 않았어요."
      links={[
        { href: "/polaroid", label: "무료 결과로 돌아가기" },
        { href: "/checkout", label: "상품 안내 · 판매 준비 중" },
      ]}
    />
  );
}
