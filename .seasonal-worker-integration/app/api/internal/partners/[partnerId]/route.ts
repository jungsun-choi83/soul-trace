import { requireServiceToken } from "@/lib/internal-auth";
import { parseShareRate } from "@/lib/partner";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * PATCH /api/internal/partners/[partnerId] — **서버 대 서버 전용.**
 *
 * 파트너를 켜고 끄고, 이름·비율을 고친다.
 *
 * ── 끄는 것과 지우는 것은 다르다 ────────────────────────────────────────────
 * 계약이 끝난 파트너는 `active=false` 로 둔다. 지우면 이미 귀속된 편지의 FK 가
 * NULL 로 풀리고(on delete set null), 그 순간 **과거 정산 근거가 사라진다.**
 * 끄면 새 귀속만 멈추고 과거는 그대로다 — 그게 장부다.
 *
 * ── 비율을 고쳐도 과거 주문은 움직이지 않는다 ───────────────────────────────
 * physical_orders 가 주문 시점 비율을 스냅샷으로 들고 있기 때문이다
 * (Eternal Beam 20260901000000_partner_track_and_rate.sql). 여기서 바꾸는 값은
 * **앞으로 만들어질** 주문에만 적용된다.
 */

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> },
) {
  const gate = requireServiceToken(request);
  if (!gate.ok) return gate.response;

  const { partnerId } = await params;
  if (!partnerId.trim()) {
    return NextResponse.json({ error: "partnerId is required." }, { status: 400 });
  }

  let body: { active?: unknown; partnerName?: unknown; shareRate?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.active !== undefined) patch.active = Boolean(body.active);

  if (body.partnerName !== undefined) {
    const name = String(body.partnerName).trim();
    if (!name || name.length > 120) {
      return NextResponse.json({ error: "partnerName is invalid." }, { status: 400 });
    }
    patch.partner_name = name;
  }

  if (body.shareRate !== undefined) {
    const rate = parseShareRate(body.shareRate);
    if (rate === null) {
      return NextResponse.json(
        { error: "shareRate must be a decimal between 0 and 1 (0.15 = 15%)." },
        { status: 400 },
      );
    }
    patch.share_rate = rate;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data, error } = await supabase
    .from("partners")
    .update(patch)
    .eq("partner_id", partnerId)
    .select("partner_id, partner_type, partner_name, share_rate, active")
    .maybeSingle();

  if (error) {
    console.error("[internal/partners] 파트너 수정 실패:", error.message);
    return NextResponse.json({ error: "Could not update partner." }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Partner not found." }, { status: 404 });
  }

  const row = data as {
    partner_id: string;
    partner_type: string;
    partner_name: string;
    share_rate: number | string | null;
    active: boolean;
  };

  console.warn(
    "[internal/partners] 파트너 수정 — %s fields=%s",
    partnerId,
    Object.keys(patch).join(","),
  );

  return NextResponse.json(
    {
      partnerId: row.partner_id,
      partnerType: row.partner_type,
      partnerName: row.partner_name,
      shareRate: parseShareRate(row.share_rate) ?? 0,
      active: row.active,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
