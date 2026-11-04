import { FlowNote } from "@/components/flow-note";
import { authEntryPath } from "@/lib/auth-redirect";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "가족 초대" };

export default async function FamilyInvitePage() {
  const supabase = await createSupabaseAuthServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) redirect(authEntryPath("/family/invite"));
  return (
    <FlowNote
      signedIn
      lifeStatus="memorial"
      tab="home"
      title="가족 초대"
      body="초대 메일과 권한 변경은 아직 열리지 않았습니다. 이 화면에서 가족에게 기록이 전달되지 않습니다."
      links={[{ href: "/family", label: "가족 공유 안내" }]}
    />
  );
}
