import { requireServiceToken } from "@/lib/internal-auth";
import { isLetterMode } from "@/lib/letter-mode";
import {
  createPartnerCode,
  createPartnerId,
  isPartnerType,
  parseShareRate,
} from "@/lib/partner";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

/**
 * GET/POST /api/internal/partners — **서버 대 서버 전용.** 운영 콘솔의 뒷면.
 *
 *   GET   파트너 + 코드 목록 (운영 화면 한 장)
 *   POST  파트너 신규 등록 (+ 원하면 첫 QR 코드까지 함께 발급)
 *
 * ── 왜 브라우저가 직접 부르지 않는가 ────────────────────────────────────────
 * partners/partner_codes 는 Soul Trace 프로젝트에 있고 service-role 로만 쓸 수
 * 있다. Eternal Beam 브라우저에 그 권한을 주면 정산 테이블을 고칠 수 있는 키가
 * 프론트엔드에 놓인다. 그래서 흐름은 언제나:
 *
 *   운영자 브라우저 → (JWT + SHAKER_OPS_USER_IDS) Eternal Beam 서버
 *                   → (X-EB-Service-Token) 여기 → Soul Trace DB
 *
 * ── 여기가 정하는 것 ────────────────────────────────────────────────────────
 * partner_id 와 코드 문자열은 **서버가 만든다.** 요청 본문으로 받지 않는다 —
 * 받으면 남의 병원 id 로 귀속을 만들거나, 추측 가능한 코드를 심을 수 있다.
 */

export const dynamic = "force-dynamic";

type PartnerCodeRow = {
  code: string;
  track: string | null;
  active: boolean;
  created_at: string;
};

export async function GET(request: Request) {
  const gate = requireServiceToken(request);
  if (!gate.ok) return gate.response;

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: partners, error: partnersError } = await supabase
    .from("partners")
    .select("partner_id, partner_type, partner_name, share_rate, active, created_at")
    .order("created_at", { ascending: false });

  if (partnersError) {
    console.error("[internal/partners] 파트너 조회 실패:", partnersError.message);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  const { data: codes, error: codesError } = await supabase
    .from("partner_codes")
    .select("code, partner_id, track, active, created_at")
    .order("created_at", { ascending: false });

  if (codesError) {
    console.error("[internal/partners] 코드 조회 실패:", codesError.message);
    return NextResponse.json({ error: "Unavailable." }, { status: 503 });
  }

  // 코드를 파트너별로 묶어서 준다. 운영 화면은 파트너 한 줄 아래 코드를 늘어놓는
  // 모양이라, 여기서 묶어 주면 화면이 조인을 다시 하지 않는다.
  const byPartner = new Map<string, PartnerCodeRow[]>();
  for (const c of (codes ?? []) as (PartnerCodeRow & { partner_id: string })[]) {
    const list = byPartner.get(c.partner_id) ?? [];
    list.push({ code: c.code, track: c.track, active: c.active, created_at: c.created_at });
    byPartner.set(c.partner_id, list);
  }

  return NextResponse.json(
    {
      partners: (partners ?? []).map((p) => {
        const row = p as {
          partner_id: string;
          partner_type: string;
          partner_name: string;
          share_rate: number | string | null;
          active: boolean;
          created_at: string;
        };
        return {
          partnerId: row.partner_id,
          partnerType: row.partner_type,
          partnerName: row.partner_name,
          // numeric 은 supabase-js 가 문자열로 줄 수 있다 — 화면이 파싱하지 않도록
          // 여기서 숫자로 고정한다.
          shareRate: parseShareRate(row.share_rate) ?? 0,
          active: row.active,
          createdAt: row.created_at,
          codes: (byPartner.get(row.partner_id) ?? []).map((c) => ({
            code: c.code,
            track: c.track,
            active: c.active,
            createdAt: c.created_at,
          })),
        };
      }),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const gate = requireServiceToken(request);
  if (!gate.ok) return gate.response;

  let body: {
    partnerName?: unknown;
    partnerType?: unknown;
    shareRate?: unknown;
    active?: unknown;
    initialTrack?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const partnerName = String(body.partnerName ?? "").trim();
  if (!partnerName || partnerName.length > 120) {
    return NextResponse.json({ error: "partnerName is required." }, { status: 400 });
  }
  if (!isPartnerType(body.partnerType)) {
    return NextResponse.json({ error: "partnerType must be HOSPITAL or FUNERAL." }, { status: 400 });
  }
  const shareRate = parseShareRate(body.shareRate ?? 0);
  if (shareRate === null) {
    // 0.15 를 15 로 적는 실수가 가장 흔하다. 통과시키면 매출의 1500% 를 정산한다.
    return NextResponse.json(
      { error: "shareRate must be a decimal between 0 and 1 (0.15 = 15%)." },
      { status: 400 },
    );
  }
  const active = body.active === undefined ? true : Boolean(body.active);

  const supabase = createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const partnerId = createPartnerId(body.partnerType);

  const { error: insertError } = await supabase.from("partners").insert({
    partner_id: partnerId,
    partner_type: body.partnerType,
    partner_name: partnerName,
    share_rate: shareRate,
    active,
  });

  if (insertError) {
    console.error("[internal/partners] 파트너 생성 실패:", insertError.message);
    return NextResponse.json({ error: "Could not create partner." }, { status: 503 });
  }

  // 등록과 동시에 첫 QR 을 원하면 여기서 함께 발급한다. 두 번 왕복하지 않아도
  // 되고, 실패해도 파트너는 남는다 — 코드는 언제든 다시 발급할 수 있다.
  let firstCode: { code: string; track: string | null } | null = null;
  if (isLetterMode(body.initialTrack)) {
    const code = createPartnerCode();
    const { error: codeError } = await supabase.from("partner_codes").insert({
      code,
      partner_id: partnerId,
      track: body.initialTrack,
      active: true,
    });
    if (codeError) {
      console.error("[internal/partners] 첫 코드 발급 실패:", codeError.message);
    } else {
      firstCode = { code, track: body.initialTrack };
    }
  }

  console.warn("[internal/partners] 파트너 생성 — %s (%s)", partnerId, body.partnerType);

  return NextResponse.json(
    {
      partnerId,
      partnerType: body.partnerType,
      partnerName,
      shareRate,
      active,
      codes: firstCode ? [{ ...firstCode, active: true }] : [],
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
