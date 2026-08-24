import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PARTNER_CODE_PARAM,
  createPartnerCode,
  createPartnerId,
  looksLikePartnerCode,
  parseShareRate,
  readPartnerCode,
  resolvePartnerCode,
} from "./partner.ts";
import { LETTER_MODES } from "./letter-mode.ts";

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
      partnerCode: "abcdefghijkl", partnerTrack: null, partnerShareRate: 0,
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

describe("QR 갈래(track) — 기존 Living/Memorial 과 같은 개념", () => {
  it("코드의 갈래를 그대로 돌려준다", async () => {
    for (const track of ["living", "memorial"] as const) {
      const p = await resolvePartnerCode(
        fakeSupabase({ ...HOSPITAL, track }),
        "abcdefghijkl",
      );
      assert.equal(p?.partnerTrack, track);
    }
  });

  it("갈래는 LetterMode 와 **같은 낱말**이어야 한다 — 두 벌을 만들지 않는다", () => {
    // 이 검사가 실패하면 누군가 갈래를 'LIVING'/'PRE_LOSS' 같은 다른 어휘로
    // 늘린 것이고, 그 순간 프롬프트를 가르는 개념이 두 개가 된다.
    assert.deepEqual([...LETTER_MODES], ["living", "memorial"]);
  });

  it("모르는 갈래는 버리되 **귀속은 살린다** — 정산을 잃지 않는다", async () => {
    const p = await resolvePartnerCode(
      fakeSupabase({ ...HOSPITAL, track: "PRE_LOSS" }),
      "abcdefghijkl",
    );
    assert.equal(p?.partnerId, "ptn_hosp_001", "귀속까지 함께 버렸다");
    assert.equal(p?.partnerTrack, null);
  });
});

describe("정산 비율 — 돈이 걸린 값", () => {
  it("0.15 는 통과하고 15 는 거절한다", () => {
    assert.equal(parseShareRate(0.15), 0.15);
    assert.equal(parseShareRate("0.15"), 0.15);
    assert.equal(parseShareRate(0), 0);
    assert.equal(parseShareRate(1), 1);
    // 15 를 15% 로 알고 넣는 실수. 통과하면 매출의 1500% 를 정산한다.
    assert.equal(parseShareRate(15), null);
    assert.equal(parseShareRate(-0.1), null);
    assert.equal(parseShareRate("abc"), null);
    assert.equal(parseShareRate(null), null);
  });

  it("numeric 이 문자열로 와도 숫자로 읽는다", async () => {
    const row = { ...HOSPITAL, partners: { ...HOSPITAL.partners, share_rate: "0.1500" } };
    const p = await resolvePartnerCode(fakeSupabase(row), "abcdefghijkl");
    assert.equal(p?.partnerShareRate, 0.15);
  });

  it("범위 밖 비율은 0 으로 — 틀린 비율로 정산하느니 눈에 띄게 둔다", async () => {
    const row = { ...HOSPITAL, partners: { ...HOSPITAL.partners, share_rate: 15 } };
    const p = await resolvePartnerCode(fakeSupabase(row), "abcdefghijkl");
    assert.equal(p?.partnerShareRate, 0);
  });
});

describe("partner_id 는 서버가 만든다", () => {
  it("유형별 접두사를 붙이고 충돌하지 않는다", () => {
    const ids = Array.from({ length: 200 }, () => createPartnerId("HOSPITAL"));
    assert.equal(new Set(ids).size, 200);
    for (const id of ids) assert.match(id, /^ptn_hosp_[0-9a-f]{12}$/);
    assert.match(createPartnerId("FUNERAL"), /^ptn_fnrl_[0-9a-f]{12}$/);
  });
});

describe("파트너 코드가 갈림길에서 사라지지 않는다", () => {
  it("랜딩이 ?p= 를 다음 화면으로 넘긴다", async () => {
    const { readFileSync } = await import("node:fs");
    const page = readFileSync("app/page.tsx", "utf8");
    const choice = readFileSync("components/mode-choice.tsx", "utf8");

    // 예전에는 `href={letterModePath(mode)}` 라 QR 로 들어온 사람이 갈래를 고르는
    // 순간 코드가 사라졌다 — QR 은 멀쩡해 보이고 정산만 비었다.
    assert.ok(
      choice.includes(`${"$"}{path}?${"$"}{PARTNER_CODE_PARAM}=`),
      "갈래 링크가 파트너 코드를 다시 싣지 않는다",
    );
    assert.ok(
      page.includes("resolvePartnerCode"),
      "랜딩이 갈래를 서버에서 확정하지 않는다",
    );
    assert.ok(
      !/href={letterModePath\(mode\)}/.test(choice),
      "코드를 버리는 옛 링크가 남아 있다",
    );
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
