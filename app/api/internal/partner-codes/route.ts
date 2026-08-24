import { requireServiceToken } from "@/lib/internal-auth";
import { isLetterMode } from "@/lib/letter-mode";
import { createPartnerCode } from "@/lib/partner";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * POST /api/internal/partner-codes — **서버 대 서버 전용.** QR 코드 발급.
 *
 * 한 파트너가 여러 코드를 갖는 것이 설계 전제다(지점·캠페인·갈래별). 그래서
 * 발급은 파트너 생성과 분리돼 있고 몇 번이든 부를 수 있다.
 *
 * ── 코드 문자열은 요청으로 받지 않는다 ──────────────────────────────────────
 * 기존 createPartnerCode() 를 그대로 쓴다 — randomBytes(12) 의 base64url.
 * 읽을 수 있는 코드(HOSPITAL_001)를 허용하면 남의 코드를 추측해 남의 병원에
 * 귀속시킬 수 있고, 그건 정산을 훔칠 수 있다는 뜻이다. QR 은 공개된 종이에
 * 찍히므로 이 성질이 유일한 방어다.
 *
 * ── track 은 왜 발급 시점에 고정하는가 ──────────────────────────────────────
 * 병원 대기실 QR 과 장례식장 QR 은 들어오는 사람이 다르다. 종이에 인쇄돼 벽에
 * 붙은 뒤에는 바꿀 수 없으므로, 코드 자체가 갈래를 들고 있어야 한다.
 * 값은 Soul Trace 가 이미 쓰는 LetterMode('living'|'memorial')와 같은 낱말이다.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = requireServiceToken(request);
  if (!gate.ok) return gate.response;

  let body: { partnerId?: unknown; track?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const partnerId = String(body.partnerId ?? "").trim();
  if (!partnerId) {
    return NextResponse.json({ error: "partnerId is required." }, { status: 400 });
  }
  // track 은 선택이다 — 없으면 고객이 첫 화면에서 직접 고른다(기존 동작).
  const track = body.track === undefined || body.track === null ? null : body.track;
  if (track !== null && !isLetterMode(track)) {
    return NextResponse.json(
      { error: "track must be 'living' or 'memorial'." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  // 파트너가 실제로 있는지 확인한다. FK 가 막아 주지만, 그 실패는 23503 이라
  // 운영자에게는 원인이 보이지 않는 500 으로 보인다.
  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("partner_id")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (partnerError) {
    console.error("[internal/partner-codes] 파트너 확인 실패:", partnerError.message);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }
  if (!partner) {
    return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  }

  // 충돌은 사실상 일어나지 않지만(96비트), 일어나면 조용히 실패하는 대신 다시
  // 뽑는다. 코드는 PK 라 중복이면 insert 가 거절된다.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = createPartnerCode();
    const { error } = await supabase
      .from("partner_codes")
      .insert({ code, partner_id: partnerId, track, active: true });

    if (!error) {
      console.warn(
        "[internal/partner-codes] 코드 발급 — partner=%s track=%s",
        partnerId,
        track ?? "(none)",
      );
      return NextResponse.json(
        { code, partnerId, track, active: true },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    }

    const msg = error.message.toLowerCase();
    const collision = msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505");
    if (!collision) {
      console.error("[internal/partner-codes] 코드 발급 실패:", error.message);
      return NextResponse.json({ error: "Could not issue code." }, { status: 503 });
    }
  }

  console.error("[internal/partner-codes] 코드 충돌이 3회 반복 — 발급 포기");
  return NextResponse.json({ error: "Could not issue code." }, { status: 503 });
}
