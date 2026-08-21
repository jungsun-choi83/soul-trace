import {
  createHandoffToken,
  handoffExpiryFrom,
  hashHandoffToken,
  looksLikeLetterId,
} from "@/lib/handoff";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * POST /api/handoff — 편지 하나를 Eternal Beam 으로 넘길 **일회용 능력**을 발급한다.
 *
 *   입력  { letterId }
 *   출력  { traceId, handoff }      ← 원문 토큰은 여기서 한 번만 나간다
 *
 * ── 무엇이 나가지 않는가 ────────────────────────────────────────────────────
 * 편지 본문·설문 답변·이메일·펫 이미지 어느 것도 응답에 없다. 그래서 이 응답이
 * 그대로 URL 이 돼도 개인정보가 새지 않는다. Eternal Beam 은 본문을 **서버 대
 * 서버로** 따로 가져간다(/api/internal/letter).
 *
 * ── 이 라우트의 보안 모델 ───────────────────────────────────────────────────
 * Soul Trace 에는 로그인이 없으므로 이 라우트도 인증을 요구할 수 없다. 대신
 * letterId 자체가 능력이다: DB 가 만든 122비트 UUID 이고, 편지를 생성한 그
 * 브라우저에게만 응답으로 돌아간다. 추측으로 도달할 수 없다.
 *
 * 그래서 letterId 를 **URL 이 아닌 곳**에서만 다뤄야 한다는 규칙이 따라온다 —
 * traceId 는 URL 에 실리지만, 그것만으로는 편지를 읽을 수 없다(핸드오프 토큰이
 * 함께 있어야 하고, 그 토큰은 한 번 쓰이면 죽는다).
 */
export async function POST(request: Request) {
  let body: { letterId?: unknown };
  try {
    body = (await request.json()) as { letterId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const letterId = body.letterId;
  if (!looksLikeLetterId(letterId)) {
    return NextResponse.json({ error: "letterId 가 필요합니다." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "핸드오프를 준비하지 못했습니다." },
      { status: 503 },
    );
  }

  // 편지가 실제로 있는지 확인한다. 없는 편지에 토큰을 발급하면, Eternal Beam 이
  // 교환 단계에서야 실패를 발견하고 사용자는 로그인까지 마친 뒤 빈손이 된다.
  const { data: profile, error: lookupError } = await supabase
    .from("soul_trace_profiles")
    .select("letter_id")
    .eq("letter_id", letterId)
    .maybeSingle();

  if (lookupError) {
    console.error("[handoff] 편지 조회 실패:", lookupError.message);
    return NextResponse.json(
      { error: "핸드오프를 준비하지 못했습니다." },
      { status: 503 },
    );
  }
  if (!profile) {
    // 없는 편지와 남의 편지를 구분해 주지 않는다.
    return NextResponse.json({ error: "편지를 찾을 수 없습니다." }, { status: 404 });
  }

  const token = createHandoffToken();
  const now = new Date();

  const { error: insertError } = await supabase.from("soul_trace_handoffs").insert({
    token_hash: hashHandoffToken(token),
    letter_id: letterId,
    expires_at: handoffExpiryFrom(now).toISOString(),
  });

  if (insertError) {
    console.error("[handoff] 토큰 저장 실패:", insertError.message);
    return NextResponse.json(
      { error: "핸드오프를 준비하지 못했습니다." },
      { status: 503 },
    );
  }

  // 원문 토큰은 여기서만 나간다. 서버에는 해시만 남아 있다.
  return NextResponse.json(
    { traceId: letterId, handoff: token },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
