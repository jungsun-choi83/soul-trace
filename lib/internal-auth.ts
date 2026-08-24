import { serviceTokenMatches } from "@/lib/handoff";
import { NextResponse } from "next/server";

/**
 * 서버 대 서버 전용 라우트의 공통 관문.
 *
 * `app/api/internal/letter` 가 쓰던 검사와 **같은 것**이다. 파트너 운영 라우트가
 * 생기면서 두 곳이 됐고, 복사해 두면 한쪽만 고쳐지는 날이 온다 — 그 한쪽이
 * 인증이면 조용히 열린 문이 된다.
 *
 * ── 왜 이 경계가 성립하는가 ─────────────────────────────────────────────────
 * 커스텀 헤더(X-EB-Service-Token)는 CORS 프리플라이트를 유발하고, 이 라우트들은
 * Access-Control-Allow-Origin 을 내보내지 않는다. 그래서 다른 오리진의 브라우저
 * 코드는 응답을 읽을 수 없고, 헤더가 없으면 그 전에 이미 401 이다.
 *
 * ⚠️ 이것은 **운영자 인가가 아니다.** "요청이 Eternal Beam 서버에서 왔다"까지만
 *    증명한다. 어느 직원이 눌렀는지는 Eternal Beam 쪽 JWT + SHAKER_OPS_USER_IDS
 *    가 판단하고, 그 결과만 이 문을 통과한다.
 */

const SERVICE_TOKEN_HEADER = "x-eb-service-token";

export type ServiceGateFailure = { ok: false; response: NextResponse };
export type ServiceGateResult = { ok: true } | ServiceGateFailure;

export function requireServiceToken(request: Request): ServiceGateResult {
  const expected = process.env.SOUL_TRACE_SERVICE_TOKEN?.trim() ?? "";
  if (!expected) {
    // 비밀이 설정되지 않았으면 **아무도 통과시키지 않는다.** 여기서 조용히
    // 열어 두면 설정 누락이 곧 인증 없는 관리 경로가 된다.
    console.error("[internal] SOUL_TRACE_SERVICE_TOKEN 미설정 — 요청 거절");
    return {
      ok: false,
      response: NextResponse.json({ error: "Not configured." }, { status: 503 }),
    };
  }

  const provided = request.headers.get(SERVICE_TOKEN_HEADER)?.trim() ?? "";
  if (!serviceTokenMatches(provided, expected)) {
    // 왜 거절됐는지 알려 주지 않는다 — 탐색 힌트를 주지 않는다.
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  return { ok: true };
}
