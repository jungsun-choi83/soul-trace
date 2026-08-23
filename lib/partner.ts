import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface ResolvedPartner {
  partnerId: string;
  partnerType: PartnerType;
  partnerName: string;
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
    .select("partner_id, active, partners(partner_id, partner_type, partner_name, active)")
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
    | { partner_id?: string; partner_type?: string; partner_name?: string; active?: boolean }
    | undefined;

  if (!p?.partner_id || p.active !== true) return null;
  if (p.partner_type !== "HOSPITAL" && p.partner_type !== "FUNERAL") return null;

  return {
    partnerId: p.partner_id,
    partnerType: p.partner_type,
    partnerName: String(p.partner_name ?? ""),
  };
}
