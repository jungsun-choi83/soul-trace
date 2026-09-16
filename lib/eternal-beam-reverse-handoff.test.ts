import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };

test("reverse callback redeems server-side and removes handoff from URL", () => {
  const callback = readFileSync("app/eternal-beam-access/route.ts", "utf8");
  const redeem = readFileSync("lib/eternal-beam-access-redemption.ts", "utf8");
  assert.match(callback, /redeemEternalBeamAccess\(handoff\)/);
  assert.match(callback, /redirect\(request, "\/life-archive"\)/);
  assert.match(callback, /Referrer-Policy.*no-referrer/);
  assert.doesNotMatch(callback, /console\./);
  assert.match(redeem, /X-EB-Service-Token/);
  assert.match(redeem, /cache: "no-store"/);
});

test("persistent session is opaque, hashed, scoped, expiring and revocable", () => {
  const source = readFileSync("lib/eternal-beam-access.ts", "utf8");
  assert.match(source, /randomBytes\(32\).*base64url/);
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /\.eq\("scope", ACCESS_SCOPE\)/);
  assert.match(source, /\.is\("revoked_at", null\)/);
  assert.match(source, /\.gt\("expires_at"/);
});

test("handoff failure copy is localized naturally", () => {
  assert.equal(en.lifeArchive.accessHandoffError.body, "We couldn't verify your Eternal Beam access.\nPlease return to Eternal Beam and try again.");
  assert.equal(ko.lifeArchive.accessHandoffError.body, "Eternal Beam 이용 권한을 확인하지 못했어요.\nEternal Beam으로 돌아가 다시 시도해 주세요.");
  assert.equal(ko.lifeArchive.title, "삶의 기록");
});
