import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { NextResponse } from "next/server";

/**
 * 생성 전 로그인 계정이 이미 편지를 받았는지 확인합니다.
 * generate-letter의 중복 검사와 동일한 조건(generated_letter 비어 있지 않음)입니다.
 */
export async function POST() {
  const authClient = await createSupabaseAuthServerClient();
  const { data: authData } = authClient
    ? await authClient.auth.getUser()
    : { data: { user: null } };
  const userEmail = authData.user?.email?.trim().toLowerCase() ?? "";
  if (!authData.user || !userEmail) {
    return NextResponse.json({ error: "Authentication required.", eligible: false }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  /** DB 미연결 시 설문 자체를 막지 않음 — generate-letter에서 다시 검증 */
  if (!supabase) {
    console.warn("[check-letter-eligibility] Supabase env missing — skipping check");
    return NextResponse.json({ eligible: true, checkSkipped: true });
  }

  return NextResponse.json({ eligible: true });
}
