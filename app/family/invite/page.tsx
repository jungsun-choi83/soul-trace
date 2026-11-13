import { FlowNote } from "@/components/flow-note";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "가족 초대" };

export default function FamilyInvitePage() {
  return (
    <FlowNote
      signedIn={false}
      lifeStatus="memorial"
      tab="home"
      title="가족 초대"
      body="초대 메일과 권한 변경은 아직 열리지 않았습니다. 이 화면에서 가족에게 기록이 전달되지 않습니다."
      links={[{ href: "/family", label: "가족 공유 안내" }]}
    />
  );
}
