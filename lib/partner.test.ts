import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTNER_CODE_PARAM,
  createPartnerCode,
  looksLikePartnerCode,
  readPartnerCode,
  resolvePartnerCode,
} from "./partner.ts";

/** partner_codes / partners 조회를 흉내 내는 최소 supabase 대역. */
function fakeSupabase(row: unknown, error: { message: string } | null = null) {
  return {
    from() {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({ data: row, error }),
      };
      return q;
    },
  } as never;
}

const HOSPITAL = {
  partner_id: "ptn_hosp_001",
  active: true,
  partners: {
    partner_id: "ptn_hosp_001", partner_type: "HOSPITAL",
    partner_name: "서울동물병원", active: true,
  },
};

describe("파트너 코드 모양", () => {
  it("발급 코드는 불투명하고 추측 불가하다", () => {
    const seen = new Set(Array.from({ length: 300 }, () => createPartnerCode()));
    assert.equal(seen.size, 300);
    for (const c of seen) assert.ok(looksLikePartnerCode(c));
  });

  it("모양이 틀린 값은 거른다 — DB 를 때리기 전에", () => {
    for (const bad of ["", "a", "has space", "x".repeat(65), null, 42, "세미콜론;"]) {
      assert.equal(looksLikePartnerCode(bad), false, String(bad));
    }
  });

  it("URL 에서 코드를 읽는다", () => {
    const c = createPartnerCode();
    assert.equal(readPartnerCode(`?${PARTNER_CODE_PARAM}=${c}`), c);
    assert.equal(readPartnerCode(""), null);
    assert.equal(readPartnerCode("?p=bad code"), null);
    assert.equal(readPartnerCode("?other=x"), null);
  });
});

describe("코드 → 파트너 해석 (서버 전용)", () => {
  it("정상 코드는 파트너를 돌려준다", async () => {
    const p = await resolvePartnerCode(fakeSupabase(HOSPITAL), "abcdefghijkl");
    assert.deepEqual(p, {
      partnerId: "ptn_hosp_001", partnerType: "HOSPITAL", partnerName: "서울동물병원",
    });
  });

  it("**파트너가 비활성이면 귀속하지 않는다** — 계약이 끝난 곳에 정산이 쌓이면 안 된다", async () => {
    const row = { ...HOSPITAL, partners: { ...HOSPITAL.partners, active: false } };
    assert.equal(await resolvePartnerCode(fakeSupabase(row), "abcdefghijkl"), null);
  });

  it("없는 코드는 null — 편지 생성을 막지 않는다", async () => {
    assert.equal(await resolvePartnerCode(fakeSupabase(null), "abcdefghijkl"), null);
  });

  it("조회 실패도 null — 틀린 귀속보다 없는 귀속이 낫다", async () => {
    assert.equal(
      await resolvePartnerCode(fakeSupabase(null, { message: "down" }), "abcdefghijkl"),
      null,
    );
  });

  it("모르는 유형은 받아들이지 않는다", async () => {
    const row = { ...HOSPITAL, partners: { ...HOSPITAL.partners, partner_type: "CAFE" } };
    assert.equal(await resolvePartnerCode(fakeSupabase(row), "abcdefghijkl"), null);
  });

  it("모양이 틀린 코드는 조회조차 하지 않는다", async () => {
    let touched = false;
    const spy = { from() { touched = true; return {} as never; } } as never;
    assert.equal(await resolvePartnerCode(spy, "bad code"), null);
    assert.equal(touched, false);
  });
});

describe("구조 고정 — 브라우저는 partner_id 를 보내지 않는다", () => {
  it("생성 요청은 코드만 싣는다", async () => {
    const { readFileSync } = await import("node:fs");
    const route = readFileSync("app/api/generate-letter/route.ts", "utf8");
    const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

    assert.ok(route.includes("partnerCode?: string"), "요청 타입에 partnerCode 가 없다");
    assert.ok(
      !/partnerId\??:\s*string/.test(route.split("type RequestBody")[1]?.split("}")[0] ?? ""),
      "요청 바디에 partnerId 가 있으면 브라우저가 귀속을 정할 수 있다",
    );
    assert.ok(flow.includes("partnerCode: partnerCode"), "화면이 코드를 보내지 않는다");
    assert.ok(!flow.includes("partnerId:"), "화면이 partner_id 를 보내고 있다");
  });
});
