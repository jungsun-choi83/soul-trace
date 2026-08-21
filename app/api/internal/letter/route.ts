import {
  looksLikeHandoffToken,
  looksLikeLetterId,
  hashHandoffToken,
  serviceTokenMatches,
} from "@/lib/handoff";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * POST /api/internal/letter — **서버 대 서버 전용.** 브라우저가 부를 일이 없다.
 *
 *   헤더  X-EB-Service-Token: <공유 비밀>
 *   입력  { traceId, handoff, consumedBy? }
 *   출력  { letterId, letterBody, petName }
 *
 * 여기가 편지 본문이 Soul Trace 를 떠나는 **유일한** 지점이다. 그래서 네 가지를
 * 모두 통과해야만 한다: 서비스 토큰 · 편지 존재 · 해시 일치 · 미만료 미소비.
 *
 * ── 설문 답변을 돌려주지 않는 이유 ──────────────────────────────────────────
 * Eternal Beam 이 필요로 하는 것은 인쇄할 본문과 이름뿐이다. 답변은 인쇄되지도
 * 표시되지도 않는다. 필요 없는 개인정보를 프로젝트 경계 밖으로 내보내면, 그때부터
 * 두 곳에서 지켜야 한다.
 *
 * ── 브라우저가 이 라우트에 닿을 수 없는 이유 ────────────────────────────────
 * 커스텀 헤더(X-EB-Service-Token)는 CORS 프리플라이트를 유발하고, 이 라우트는
 * Access-Control-Allow-Origin 을 내보내지 않는다. 그래서 다른 오리진의 브라우저
 * 코드는 응답을 읽을 수 없다. 헤더가 없으면 401 이라 그 전에 이미 막힌다.
 */

const SERVICE_TOKEN_HEADER = "x-eb-service-token";

function unauthorized() {
  // 왜 거절됐는지 알려 주지 않는다 — 탐색 힌트를 주지 않는다.
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function POST(request: Request) {
  const expected = process.env.SOUL_TRACE_SERVICE_TOKEN?.trim() ?? "";
  if (!expected) {
    // 비밀이 설정되지 않았으면 **아무도 통과시키지 않는다.** 여기서 조용히
    // 열어 두면 설정 누락이 곧 인증 없는 편지 유출 경로가 된다.
    console.error("[internal/letter] SOUL_TRACE_SERVICE_TOKEN 미설정 — 요청 거절");
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const provided = request.headers.get(SERVICE_TOKEN_HEADER)?.trim() ?? "";
  if (!serviceTokenMatches(provided, expected)) {
    return unauthorized();
  }

  let body: { traceId?: unknown; handoff?: unknown; consumedBy?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const traceId = body.traceId;
  const handoff = body.handoff;
  if (!looksLikeLetterId(traceId) || !looksLikeHandoffToken(handoff)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const consumedBy =
    typeof body.consumedBy === "string" && body.consumedBy.trim().length > 0
      ? body.consumedBy.trim().slice(0, 320)
      : null;

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  // ── 원자적 소비 ────────────────────────────────────────────────────────────
  // 한 문장이다. 읽고-확인하고-쓰는 세 문장으로 나누면 그 사이에 두 번째 요청이
  // 들어와 같은 토큰이 두 번 통과한다. 여기서는 행 잠금 덕에 정확히 하나만
  // 행을 얻고, 나머지는 빈 결과를 받는다.
  //
  // 조건이 넷인 이유: 해시 일치(token_hash) · 이 편지의 토큰인지(letter_id) ·
  // 아직 안 쓰였는지(consumed_at is null) · 안 죽었는지(expires_at > now).
  const nowIso = new Date().toISOString();
  const { data: consumed, error: consumeError } = await supabase
    .from("soul_trace_handoffs")
    .update({ consumed_at: nowIso, consumed_by: consumedBy })
    .eq("token_hash", hashHandoffToken(handoff))
    .eq("letter_id", traceId)
    .is("consumed_at", null)
    .gt("expires_at", nowIso)
    .select("letter_id");

  if (consumeError) {
    console.error("[internal/letter] 토큰 소비 실패:", consumeError.message);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!consumed || consumed.length === 0) {
    // 없는 토큰 · 만료 · 이미 소비 · 다른 편지의 토큰 — 전부 같은 답을 준다.
    return NextResponse.json(
      { error: "Handoff is invalid or already used." },
      { status: 409 },
    );
  }

  // ── 정본 조회 ──────────────────────────────────────────────────────────────
  // 토큰이 가리키는 편지를 **Soul Trace 자신의 DB 에서** 읽는다. 요청 본문이
  // 들고 온 값은 어느 것도 본문의 근거가 되지 않는다.
  const { data: profile, error: profileError } = await supabase
    .from("soul_trace_profiles")
    .select("letter_id, generated_letter, pet_name")
    .eq("letter_id", traceId)
    .maybeSingle();

  if (profileError) {
    console.error("[internal/letter] 편지 조회 실패:", profileError.message);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!profile || !String(profile.generated_letter ?? "").trim()) {
    // 토큰은 이미 소비됐다. 되돌리지 않는다 — 되돌릴 수 있으면 재시도로
    // 무한히 다시 쓸 수 있는 토큰이 된다. 새 토큰을 발급받으면 된다.
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }

  console.warn(
    "[internal/letter] 핸드오프 소비 — letter=%s by=%s",
    traceId,
    consumedBy ?? "(unknown)",
  );

  return NextResponse.json(
    {
      letterId: String(profile.letter_id),
      letterBody: String(profile.generated_letter),
      petName: String(profile.pet_name ?? ""),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
