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
  // 관계를 함께 select 하면 supabase-js 의 추론이 유니온으로 벌어진다.
  // 우리가 쓰는 모양은 확정적이므로 여기서 명시한다.
  type PartnerRel = {
    partner_id?: string;
    partner_type?: string;
    partner_name?: string;
    share_rate?: number | string | null;
  };
  type ProfileRow = {
    letter_id: string;
    generated_letter: string;
    pet_name: string | null;
    partner_id: string | null;
    partner_code: string | null;
    partners?: PartnerRel | PartnerRel[] | null;
  };

  const { data: profileRaw, error: profileError } = await supabase
    .from("soul_trace_profiles")
    .select(
      "letter_id, generated_letter, pet_name, partner_id, partner_code, " +
        "partners(partner_id, partner_type, partner_name, share_rate)",
    )
    .eq("letter_id", traceId)
    .maybeSingle();

  const profile = profileRaw as ProfileRow | null;

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

  // 파트너 귀속을 함께 넘긴다. 두 프로젝트는 DB 를 공유하지 않으므로 Eternal Beam
  // 이 partners 를 조회할 방법이 없다 — 이름·유형까지 여기서 실어 보내야 운영
  // 화면이 교차 조회 없이 파트너를 보여 줄 수 있다.
  //
  // ⚠️ 이 값은 **서버가 확정한 것**이다. 브라우저는 코드만 넘겼고 partner_id 를
  //    보낸 적이 없다. 그래서 이 응답이 귀속의 정본이다.
  const rawPartner = profile.partners;
  const partner = Array.isArray(rawPartner) ? rawPartner[0] : rawPartner ?? undefined;
  const partnerCode = profile.partner_code ? String(profile.partner_code) : null;

  // 갈래(track)는 **코드**의 속성이라 partners 조인으로는 오지 않는다. 한 번 더
  // 읽는다 — 실패해도 편지를 막지 않는다(토큰은 이미 소비됐고, 갈래는 정산의
  // 부가 정보다). active 로 거르지 않는 이유: 코드가 나중에 꺼져도 **그때 그
  // 코드로 들어왔다는 사실**은 변하지 않는다.
  let partnerTrack: string | null = null;
  if (partnerCode) {
    const { data: codeRow, error: codeError } = await supabase
      .from("partner_codes")
      .select("track")
      .eq("code", partnerCode)
      .maybeSingle();
    if (codeError) {
      console.error("[internal/letter] 코드 갈래 조회 실패:", codeError.message);
    } else {
      const t = (codeRow as { track?: unknown } | null)?.track;
      partnerTrack = t === "living" || t === "memorial" ? t : null;
    }
  }

  // 정산 비율은 **지금의 계약**이다. 이 값을 얼리는 것은 주문 생성 시점이고
  // (Eternal Beam physical_orders), 여기서는 그때 쓸 입력으로 실어 보낸다.
  const rawRate = partner?.share_rate;
  const rate = typeof rawRate === "number" ? rawRate : Number(rawRate ?? NaN);

  return NextResponse.json(
    {
      letterId: String(profile.letter_id),
      letterBody: String(profile.generated_letter),
      petName: String(profile.pet_name ?? ""),
      partnerId: profile.partner_id ? String(profile.partner_id) : null,
      partnerType: partner?.partner_type ? String(partner.partner_type) : null,
      partnerName: partner?.partner_name ? String(partner.partner_name) : null,
      partnerCode,
      partnerTrack,
      partnerShareRate: Number.isFinite(rate) ? rate : null,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
