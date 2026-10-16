import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HANDOFF_TTL_MS,
  createHandoffToken,
  handoffExpiryFrom,
  hashHandoffToken,
  looksLikeHandoffToken,
  looksLikeLetterId,
  serviceTokenMatches,
} from "./handoff.ts";

describe("핸드오프 토큰", () => {
  it("256비트 · base64url 43자", () => {
    const t = createHandoffToken();
    assert.equal(t.length, 43);
    assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  });

  it("매번 다르다 — 예측 가능하면 능력이 아니다", () => {
    const seen = new Set(Array.from({ length: 500 }, () => createHandoffToken()));
    assert.equal(seen.size, 500);
  });

  it("해시는 결정적이고, 원문을 담고 있지 않다", () => {
    const t = createHandoffToken();
    const h = hashHandoffToken(t);
    assert.equal(h, hashHandoffToken(t));
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
    // 표가 유출돼도 원문을 되살릴 수 없어야 한다.
    assert.ok(!h.includes(t));
  });

  it("다른 토큰은 다른 해시", () => {
    assert.notEqual(hashHandoffToken(createHandoffToken()), hashHandoffToken(createHandoffToken()));
  });

  it("만료는 15분", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(HANDOFF_TTL_MS, 15 * 60 * 1000);
    assert.equal(handoffExpiryFrom(now).toISOString(), "2026-01-01T00:15:00.000Z");
  });
});

describe("모양 검사 — DB 를 때리기 전에 쓰레기를 거른다", () => {
  it("발급한 모양의 토큰만 통과", () => {
    assert.ok(looksLikeHandoffToken(createHandoffToken()));
    assert.ok(!looksLikeHandoffToken(""));
    assert.ok(!looksLikeHandoffToken("short"));
    assert.ok(!looksLikeHandoffToken("A".repeat(42)));
    assert.ok(!looksLikeHandoffToken("A".repeat(44)));
    // base64url 이 아닌 문자
    assert.ok(!looksLikeHandoffToken("A".repeat(42) + "+"));
    assert.ok(!looksLikeHandoffToken(null));
    assert.ok(!looksLikeHandoffToken(123));
  });

  it("UUID 만 letterId 로 통과", () => {
    assert.ok(looksLikeLetterId("3f2504e0-4f89-41d3-9a0c-0305e82c3301"));
    assert.ok(!looksLikeLetterId("not-a-uuid"));
    // 이메일은 식별자가 아니다 — URL 에 실리면 PII 가 샌다
    assert.ok(!looksLikeLetterId("someone@example.com"));
    assert.ok(!looksLikeLetterId(""));
    assert.ok(!looksLikeLetterId(undefined));
  });
});

describe("서비스 토큰 비교", () => {
  it("같으면 통과, 다르면 거절", () => {
    assert.ok(serviceTokenMatches("secret-value", "secret-value"));
    assert.ok(!serviceTokenMatches("secret-value", "other-value"));
  });

  it("빈 값은 절대 통과하지 않는다 — 설정 누락이 곧 무인증이 되면 안 된다", () => {
    assert.ok(!serviceTokenMatches("", ""));
    assert.ok(!serviceTokenMatches("", "expected"));
    assert.ok(!serviceTokenMatches("provided", ""));
  });

  it("길이가 달라도 예외 없이 false — 길이 자체도 흘리지 않는다", () => {
    assert.doesNotThrow(() => serviceTokenMatches("a", "a-much-longer-secret"));
    assert.ok(!serviceTokenMatches("a", "a-much-longer-secret"));
  });

  it("접두사가 같아도 통과하지 않는다", () => {
    assert.ok(!serviceTokenMatches("secret", "secret-value"));
    assert.ok(!serviceTokenMatches("secret-value-extra", "secret-value"));
  });
});
