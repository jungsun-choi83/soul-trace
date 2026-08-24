import { ModeChoice } from "@/components/mode-choice";
import { letterModePath } from "@/lib/letter-mode";
import {
  PARTNER_CODE_PARAM,
  looksLikePartnerCode,
  resolvePartnerCode,
} from "@/lib/partner";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

/**
 * 착지점. 직접 들어온 고객에게는 갈림길을, 파트너 QR 로 들어온 고객에게는
 * **이미 정해진 갈래**를 준다.
 *
 * ── 왜 서버 컴포넌트인가 ────────────────────────────────────────────────────
 * QR 의 갈래(track)는 `partner_codes` 에 있고, 그 테이블은 service-role 로만
 * 읽는다. 브라우저에게 물으면 코드→갈래 매핑을 공개하는 셈이고, 더 중요하게는
 * 브라우저가 갈래를 **고를 수 있게** 된다. 갈래는 프롬프트를 가르므로 그것은
 * 곧 남의 QR 로 다른 편지를 만들 수 있다는 뜻이다.
 *
 * 그래서 서버에서 확정하고, 브라우저에는 결과만 준다.
 *
 * ── 갈래가 있으면 첫 화면을 건너뛴다 ────────────────────────────────────────
 * 장례식장 QR 을 찍은 사람에게 "아이가 지금 곁에 있나요?"를 다시 묻는 것은
 * 잔인하고 불필요하다. 파트너가 이미 답을 알고 있다.
 *
 * ⚠️ 갈래는 **새 개념이 아니다.** `/living`·`/memorial` 로 보낼 뿐이고, 그 뒤는
 *    직접 들어온 고객과 완전히 같은 경로다(SoulTraceFlow → mode → 프롬프트).
 *    갈래를 두 벌 만들지 않는다.
 */
export default async function ModeChoicePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = (await searchParams)[PARTNER_CODE_PARAM];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const code = looksLikePartnerCode(candidate) ? candidate : null;

  if (!code) return <ModeChoice partnerCode={null} />;

  // 코드가 살아 있는지 여기서 확인한다. 꺼진 코드/파트너는 resolve 가 null 을
  // 주므로 갈래도 붙지 않고, 고객은 평소처럼 직접 고른다 — 편지는 막지 않는다.
  const supabase = createSupabaseServerClient();
  const partner = supabase ? await resolvePartnerCode(supabase, code) : null;

  if (partner?.partnerTrack) {
    // 코드를 그대로 실어 보낸다. 귀속을 확정하는 것은 여전히 편지 생성 시점의
    // 서버 조회이고(generate-letter), 여기서 넘긴 값은 그 입력일 뿐이다.
    redirect(
      `${letterModePath(partner.partnerTrack)}?${PARTNER_CODE_PARAM}=${encodeURIComponent(code)}`,
    );
  }

  // 갈래가 없는 코드(기존 인쇄물)도 **귀속은 살아 있어야 한다.** 코드를 링크에
  // 실어 주지 않으면 고객이 갈래를 고르는 순간 `?p=` 가 사라진다.
  return <ModeChoice partnerCode={code} />;
}
