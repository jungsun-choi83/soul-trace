import { requireServiceToken } from "@/lib/internal-auth";
import { looksLikePartnerCode } from "@/lib/partner";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/internal/partner-codes/[code] — **서버 대 서버 전용.**
 *
 * 코드를 켜고 끈다. 유출된 인쇄물을 회수할 때 쓴다.
 *
 * ── 끄면 새 귀속만 멈춘다 ───────────────────────────────────────────────────
 * resolvePartnerCode 가 `active=true` 인 코드만 통과시키므로, 끈 코드의 QR 을
 * 찍으면 귀속 없이(NULL) 편지가 만들어진다 — **편지 자체는 막지 않는다.**
 * 고객은 코드가 무엇인지 모르고, 자기 잘못도 아니다.
 *
 * 이미 그 코드로 귀속된 편지·주문은 그대로다. 파트너를 끄는 것과 같은 원칙이다.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const gate = requireServiceToken(request);
  if (!gate.ok) return gate.response;

  const { code } = await params;
  if (!looksLikePartnerCode(code)) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  let body: { active?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (body.active === undefined) {
    return NextResponse.json({ error: "active is required." }, { status: 400 });
  }

  // track 은 바꿀 수 없다. 이미 인쇄돼 벽에 붙은 QR 의 의미를 나중에 바꾸면,
  // 장례식장에 붙은 종이가 어느 날부터 living 편지를 만든다. 갈래를 바꾸고
  // 싶으면 새 코드를 발급하고 옛 코드를 끈다 — 종이도 같이 바뀌어야 하니까.
  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data, error } = await supabase
    .from("partner_codes")
    .update({ active: Boolean(body.active) })
    .eq("code", code)
    .select("code, partner_id, track, active")
    .maybeSingle();

  if (error) {
    console.error("[internal/partner-codes] 코드 수정 실패:", error.message);
    return NextResponse.json({ error: "Could not update code." }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Code not found." }, { status: 404 });
  }

  const row = data as {
    code: string;
    partner_id: string;
    track: string | null;
    active: boolean;
  };

  console.warn("[internal/partner-codes] 코드 %s — active=%s", code, row.active);

  return NextResponse.json(
    { code: row.code, partnerId: row.partner_id, track: row.track, active: row.active },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
