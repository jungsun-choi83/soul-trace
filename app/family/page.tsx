import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "가족 공유" };

export default function FamilySharePage() {
  return (
    <FlowNote
      signedIn={false}
      lifeStatus="memorial"
      tab="home"
      title="가족 공유"
      body="가족 공유는 보호자 권한을 확인한 뒤에만 열립니다. 지금은 초대를 보내지 않고, 추모 기록은 비공개로 남아 있습니다."
      links={[
        { href: "/family/invite", label: "권한 안내" },
        { href: "/dashboard/memorial", label: "추모 홈" },
      ]}
    />
  );
}
