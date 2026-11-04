import { FlowNote } from "@/components/flow-note";
import { authEntryPath } from "@/lib/auth-redirect";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "가족 공유" };

export default async function FamilySharePage() {
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect(authEntryPath("/family"));
  return (
    <FlowNote
      signedIn
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
