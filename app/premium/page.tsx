import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "유료 제작 안내" };

export default function PremiumPreviewPage() {
  return (
    <FlowNote
      tab="create"
      title="유료 제작 안내"
      body="결제와 구독은 아직 열리지 않았습니다. 이 화면에서는 결제하지 않습니다."
      links={[
        { href: "/polaroid", label: "폴라로이드" },
        { href: "/create", label: "만들기" },
      ]}
    />
  );
}
