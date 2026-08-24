import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
// 값 import 라 상대 경로를 쓴다. `@/` 별칭은 Next 번들러만 풀어 주므로,
// node --test 가 이 모듈을 직접 부르는 순간 해석에 실패한다 — 이 파일의 다른
// 별칭 import 들이 전부 `import type` 인 것도 같은 이유다(런타임에 지워진다).
import { isLetterMode, type LetterMode } from "./letter-mode.ts";

/**
 * 파트너 귀속 — **코드는 브라우저가, partner_id 는 서버가.**
 *
 * QR 에는 불투명 코드만 찍힌다:
 *
 *     https://soultrace.eternalbeam.com/?p=<code>
 *
 * 브라우저는 그 코드를 그대로 넘길 뿐이고, 어느 파트너인지는 **서버가 조회해서**
 * 정한다. 브라우저가 partner_id 를 보낼 수 있으면 누구나 남의 병원에 귀속시킬 수
 * 있고, 그것은 곧 정산을 조작할 수 있다는 뜻이다.
 *
 * ── 실패는 조용히 NULL 이다 ─────────────────────────────────────────────────
 * 코드가 틀렸거나 꺼졌으면 **귀속 없이 진행한다.** 편지 생성을 막지 않는다:
 * 고객은 코드가 무엇인지 모르고, 자기 잘못도 아니다. 잘못된 귀속을 만드는 것보다
 * 귀속이 없는 편이 낫다 — 없는 것은 나중에 채울 수 있지만, 틀린 귀속은
 * 정산이 끝난 뒤에야 드러난다.
 */

/** URL 쿼리 파라미터 이름. 짧게 — QR 에 들어가는 문자 수가 곧 조밀도다. */
export const PARTNER_CODE_PARAM = "p";

/** 발급 코드 모양: base64url 16자(96비트). 추측 불가하고 QR 에 부담이 없다. */
const CODE_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type PartnerType = "HOSPITAL" | "FUNERAL";

export const PARTNER_TYPES: readonly PartnerType[] = ["HOSPITAL", "FUNERAL"];

export function isPartnerType(value: unknown): value is PartnerType {
  return value === "HOSPITAL" || value === "FUNERAL";
}

export interface ResolvedPartner {
  partnerId: string;
  partnerType: PartnerType;
  partnerName: string;
  /** 이 귀속을 만든 코드. 파트너당 여러 코드를 구분한다. */
  partnerCode: string;
  /**
   * QR 이 고정한 갈래. **새 개념이 아니다** — lib/letter-mode.ts 의 LetterMode 와
   * 같은 낱말이고, 없으면(NULL) 고객이 첫 화면에서 직접 고른다.
   */
  partnerTrack: LetterMode | null;
  /** 정산 비율 0..1. 주문 시점에 스냅샷된다. */
  partnerShareRate: number;
}

/**
 * partner_id 는 **서버가 만든다.**
 *
 * 브라우저가 고르게 두면 남의 병원 id 를 적어 정산을 훔칠 수 있다. 사람이 읽을
 * 수 있는 접두사를 붙이는 이유는 운영 화면·로그에서 눈으로 구분하기 위해서다 —
 * **코드(QR)와 달리 partner_id 는 공개되지 않으므로** 추측 가능해도 무해하다.
 * 뒤에 무작위를 붙이는 것은 같은 이름의 병원이 둘일 때 충돌을 피하기 위함이다.
 */
export function createPartnerId(type: PartnerType): string {
  const prefix = type === "HOSPITAL" ? "ptn_hosp" : "ptn_fnrl";
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/**
 * 정산 비율 파싱 — 0..1 의 십진수만 통과시킨다.
 *
 * 15 를 15% 로 알고 넣는 실수가 가장 흔하고 가장 비싸다(매출의 1500%). 여기서
 * 막지 않으면 DB CHECK 가 막지만, 운영자는 그때 이유를 알 수 없는 500 을 본다.
 */
export function parseShareRate(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") {
    n = value;
  } else {
    // 빈 값을 Number() 에 넘기면 **0 이 나온다.** 그대로 두면 "비율을 못 읽었다"와
    // "비율이 0% 다"가 같은 값이 되고, 설정 누락이 조용히 0% 정산으로 굳는다.
    const raw = String(value ?? "").trim();
    if (!raw) return null;
    n = Number(raw);
  }
  if (!Number.isFinite(n) || n < 0 || n > 1) return null;
  // 소수 넷째 자리까지 — numeric(6,4) 와 같은 정밀도.
  return Math.round(n * 10000) / 10000;
}

/** 새 파트너 코드 — 운영이 발급할 때 쓴다. */
export function createPartnerCode(): string {
  return randomBytes(12).toString("base64url");
}

/** 모양 검사. DB 를 때리기 전에 쓰레기를 거른다. */
export function looksLikePartnerCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

/** URL 쿼리에서 코드를 꺼낸다. 없거나 모양이 틀리면 null. */
export function readPartnerCode(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get(PARTNER_CODE_PARAM)?.trim() ?? "";
    return looksLikePartnerCode(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 코드 → 파트너. **서버 전용.**
 *
 * 코드와 파트너가 **둘 다 active** 일 때만 귀속한다. 코드만 껐는데 귀속이 계속
 * 생기면 인쇄물을 회수한 의미가 없고, 파트너를 껐는데 귀속이 생기면 계약이
 * 끝난 곳에 정산이 쌓인다.
 */
export async function resolvePartnerCode(
  supabase: SupabaseClient,
  code: string | null | undefined,
): Promise<ResolvedPartner | null> {
  if (!looksLikePartnerCode(code)) return null;

  const { data, error } = await supabase
    .from("partner_codes")
    .select(
      "code, partner_id, active, track, " +
        "partners(partner_id, partner_type, partner_name, active, share_rate)",
    )
    .eq("code", code)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    // 조회 실패로 편지를 막지 않는다. 귀속만 비운다.
    console.error("[partner] 코드 조회 실패:", error.message);
    return null;
  }
  if (!data) return null;

  // Supabase 는 관계를 객체 또는 배열로 준다 — 둘 다 받는다.
  const raw = (data as { partners?: unknown }).partners;
  const p = (Array.isArray(raw) ? raw[0] : raw) as
    | {
        partner_id?: string;
        partner_type?: string;
        partner_name?: string;
        active?: boolean;
        share_rate?: number | string | null;
      }
    | undefined;

  if (!p?.partner_id || p.active !== true) return null;
  if (p.partner_type !== "HOSPITAL" && p.partner_type !== "FUNERAL") return null;

  // track 이 이상한 값이면 **귀속은 살리고 갈래만 버린다.** 갈래는 편의(첫 화면
  // 건너뛰기)일 뿐이고, 그것 때문에 정산 귀속을 잃을 이유가 없다.
  const track = (data as { track?: unknown }).track;

  return {
    partnerId: p.partner_id,
    partnerType: p.partner_type,
    partnerName: String(p.partner_name ?? ""),
    partnerCode: String((data as { code?: unknown }).code ?? code),
    partnerTrack: isLetterMode(track) ? track : null,
    // numeric 은 supabase-js 가 문자열로 줄 수 있다(정밀도 보존). 숫자로 못 읽으면
    // 0 이다 — 틀린 비율로 정산하느니 0 으로 두고 눈에 띄게 만든다.
    partnerShareRate: parseShareRate(p.share_rate) ?? 0,
  };
}
