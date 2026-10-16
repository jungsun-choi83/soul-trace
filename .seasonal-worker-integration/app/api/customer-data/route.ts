import { serviceTokenMatches } from "@/lib/handoff";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * GET /api/customer-data?email=… — **서버 대 서버 전용.** 기기 설정 플로우가 쓴다.
 *
 * ── 왜 인증이 붙었는가 ──────────────────────────────────────────────────────
 * 이 라우트는 원래 인증이 **없었다.** 이메일만 알면 누구나 편지 본문·성향·풍경·
 * 배경 이미지, 그리고 설문 답변 8개를 전부 읽을 수 있었다. 이메일은 비밀이 아니다 —
 * 고객 목록 하나면 편지 전체가 열렸다.
 *
 * 이제 /api/internal/letter 와 **같은 공유 비밀**을 요구한다. 브라우저는 커스텀
 * 헤더 때문에 CORS 프리플라이트에 막히고, 헤더가 없으면 그 전에 401 이다.
 *
 * ⚠️ 이 라우트는 핸드오프 경로가 **아니다.** Eternal Beam 이 편지를 가져갈 때는
 * /api/internal/letter 를 쓴다 — 그쪽은 일회용 토큰을 소비하고 설문 답변을
 * 돌려주지 않는다. 여기는 답변까지 돌려주므로 더 강한 이유가 있을 때만 쓴다.
 */

const SERVICE_TOKEN_HEADER = "x-eb-service-token";

export async function GET(request: Request) {
  const expected = process.env.SOUL_TRACE_SERVICE_TOKEN?.trim() ?? "";
  if (!expected) {
    // 비밀이 없으면 아무도 통과시키지 않는다. 예전처럼 열어 두는 폴백은 없다.
    console.error("[customer-data] SOUL_TRACE_SERVICE_TOKEN 미설정 — 요청 거절");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const provided = request.headers.get(SERVICE_TOKEN_HEADER)?.trim() ?? "";
  if (!serviceTokenMatches(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // createSupabaseServerClient 를 쓴다 — 이 헬퍼가 환경변수를 trim 한다.
  // (프로덕션의 NEXT_PUBLIC_SUPABASE_URL 값에는 후행 CRLF 가 들어 있어서,
  //  예전처럼 process.env 를 그대로 createClient 에 넘기면 URL 이 깨진다.)
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 환경 변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "유효한 email 쿼리 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("soul_trace_profiles")
    .select(
      "user_email, pet_name, personality_type, generated_letter, preferred_scenery, hero_image_url",
    )
    .eq("user_email", email)
    .maybeSingle();

  if (profileError) {
    console.error("[customer-data] 프로필 조회 실패:", profileError.message);
    return NextResponse.json({ error: "조회에 실패했습니다." }, { status: 503 });
  }
  if (!profile) {
    return NextResponse.json(
      { error: "해당 이메일의 저장 데이터를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: answers, error: answersError } = await supabase
    .from("soul_trace_answers")
    .select("answer_order, question, answer")
    .eq("user_email", email)
    .order("answer_order", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      { error: `답변 데이터를 불러오지 못했습니다: ${answersError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { ...profile, answers: answers ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
