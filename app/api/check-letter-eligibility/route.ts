import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

type Body = {
  email?: string;
};

/**
 * 설문·생성 전 이메일이 이미 편지를 받았는지 확인합니다.
 * generate-letter의 중복 검사와 동일한 조건(generated_letter 비어 있지 않음)입니다.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  /** DB 미연결 시 설문 자체를 막지 않음 — generate-letter에서 다시 검증 */
  if (!supabase) {
    console.warn("[check-letter-eligibility] Supabase env missing — skipping check");
    return NextResponse.json({ eligible: true, checkSkipped: true });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON.", eligible: false }, { status: 400 });
  }

  const userEmail = body.email?.trim().toLowerCase() ?? "";
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);
  if (!isEmailValid) {
    return NextResponse.json({ error: "Invalid email.", eligible: false }, { status: 400 });
  }

  const { data: existingProfile, error } = await supabase
    .from("soul_trace_profiles")
    .select("generated_letter")
    .eq("user_email", userEmail)
    .maybeSingle();

  if (error) {
    console.error("[check-letter-eligibility] Supabase query failed:", error.code, error.message);
    // 테이블 없음·권한·일시 오류 등 — 진행은 허용, 최종 생성 단계에서 재검증
    return NextResponse.json({ eligible: true, checkSkipped: true });
  }

  const hasSavedLetter = Boolean(
    existingProfile?.generated_letter &&
      String(existingProfile.generated_letter).trim().length > 0,
  );

  return NextResponse.json({ eligible: !hasSavedLetter });
}
