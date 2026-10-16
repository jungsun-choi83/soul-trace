import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { createSignedAccessToken, verifySignedAccessToken } from "./eternal-beam-access-token.ts";

const secret = "test-only-secret-with-enough-entropy-123456";
const now = Date.parse("2026-09-15T00:00:00.000Z");
const page = readFileSync("app/life-archive/page.tsx", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const generation = readFileSync("app/api/generate-letter/route.ts", "utf8");
const devRoute = readFileSync("app/api/internal/dev/life-archive-access/route.ts", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

describe("Eternal Beam Life Archive access session", () => {
  it("accepts a valid signed session", () => {
    const token = createSignedAccessToken(secret, "development", 60, now);
    assert.equal(verifySignedAccessToken(token, secret, now + 30_000), true);
  });

  it("rejects modified, invalid, removed, and expired sessions", () => {
    const token = createSignedAccessToken(secret, "eternal_beam", 60, now);
    assert.equal(verifySignedAccessToken(`${token}x`, secret, now), false);
    assert.equal(verifySignedAccessToken(token, "wrong-secret", now), false);
    assert.equal(verifySignedAccessToken(null, secret, now), false);
    assert.equal(verifySignedAccessToken(token, secret, now + 61_000), false);
  });

  it("uses an HttpOnly production-safe cookie and a non-production simulator", () => {
    const session = readFileSync("lib/eternal-beam-access.ts", "utf8");
    assert.match(session, /httpOnly:\s*true/);
    assert.match(session, /secure:\s*process\.env\.NODE_ENV === "production"/);
    assert.match(session, /sameSite:\s*"lax"/);
    assert.match(devRoute, /NODE_ENV === "production"/);
    assert.match(devRoute, /x-life-archive-dev-secret/);
    assert.doesNotMatch(devRoute, /searchParams|access=true|founder=true|purchased=true/);
  });
});

describe("Life Archive Phase 1 enforcement and localized result states", () => {
  it("blocks the page before archive data is loaded", () => {
    const gate = page.indexOf("if (!hasEternalBeamAccess)");
    const data = page.indexOf('from("soul_trace_pets")');
    assert.ok(gate >= 0 && gate < data);
  });

  it("protects every Life Archive API with the same access session", () => {
    for (const route of ["access", "memories", "photos", "videos"]) {
      const source = readFileSync(`app/api/life-archive/${route}/route.ts`, "utf8");
      assert.match(source, /requestHasEternalBeamAccess/);
    }
  });

  it("keeps public letter generation independent of Eternal Beam access", () => {
    assert.doesNotMatch(generation, /EternalBeamAccess|LIFE_ARCHIVE_ACCESS_SESSION/);
  });

  it("keeps the explanation hidden until a public visitor clicks the Journey button", () => {
    assert.match(flow, /hasEternalBeamAccess/);
    assert.match(flow, /onClick=\{handleLifeArchiveJourney\}/);
    assert.match(flow, /lifeArchiveExplanationOpen && !hasEternalBeamAccess/);
    assert.match(flow, /setLifeArchiveExplanationOpen\(true\)/);
    assert.match(flow, /if \(hasEternalBeamAccess\)[\s\S]*?continueToLifeArchive/);
    assert.match(flow, /result\.lifeArchive\.lockedBody/);
    assert.equal((flow.match(/continueToEternalBeam}/g) ?? []).length, 1);
  });

  it("uses the required English copy", () => {
    assert.equal(en.result.lifeArchive.journeyCta, "Continue Your Pet’s Journey ✨");
    assert.equal(en.result.lifeArchive.accessTitle, "Keep Their Story Growing ✨");
    assert.equal(en.result.lifeArchive.readyBody, "Your Life Archive is ready.");
    assert.equal(en.result.lifeArchive.openCta, "Open Life Archive");
    assert.equal(en.result.lifeArchive.lockedCta, "Life Archive");
  });

  it("uses 삶의 기록 consistently in the Korean access UI", () => {
    assert.equal(ko.result.lifeArchive.journeyCta, "아이의 여정을 계속 이어가기 ✨");
    assert.equal(ko.result.lifeArchive.accessTitle, "아이의 이야기를 계속 이어가세요 ✨");
    assert.equal(ko.result.lifeArchive.readyBody, "삶의 기록이 준비되어 있어요.");
    assert.equal(ko.result.lifeArchive.openCta, "삶의 기록 열기");
    assert.equal(ko.result.lifeArchive.lockedCta, "삶의 기록");
    assert.doesNotMatch(JSON.stringify(ko.result.lifeArchive), /Life Archive/);
    assert.doesNotMatch(JSON.stringify(ko.lifeArchive.accessRequired), /Life Archive/);
  });
});
