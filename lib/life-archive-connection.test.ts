import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync("app/life-archive/page.tsx", "utf8");
const preview = readFileSync("components/life-archive-preview.tsx", "utf8");
const access = readFileSync("app/api/life-archive/access/route.ts", "utf8");
const callback = readFileSync("app/auth/confirm/route.ts", "utf8");
const confirmation = readFileSync("lib/auth-confirm.ts", "utf8");
const result = readFileSync("components/soul-trace-flow.tsx", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

describe("Life Archive Phase 3 connection", () => {
  it("adds the journey action after the two existing result actions", () => {
    const keep = result.indexOf("onClick={handleDownloadImage}");
    const instagram = result.indexOf("onClick={onInstagramButtonClick}");
    const archive = result.indexOf("onClick={continueToLifeArchive}");
    assert.ok(keep >= 0 && keep < instagram && instagram < archive);
    assert.equal(en.result.lifeArchive.cta, "Continue Your Pet's Journey");
    assert.equal(ko.result.lifeArchive.cta, "아이의 여정을 계속 이어가기");
  });

  it("never puts private Soul Trace content in a URL", () => {
    assert.match(access, /body\.letterId/);
    assert.doesNotMatch(access, /searchParams\.set\([^\n]*(email|answer|letter)/i);
    assert.doesNotMatch(result, /life-archive\?(?:letter|email|answer)/i);
  });

  it("checks both the authenticated owner and selected submission", () => {
    assert.match(access, /auth\.getUser\(\)/);
    assert.match(access, /\.eq\("owner_user_id", userData\.user\.id\)/);
    assert.match(page, /ACTIVE_SUBMISSION_COOKIE/);
    assert.match(page, /\.eq\("submission_id", submissionId\)/);
    assert.match(page, /\.eq\("owner_user_id", userData\.user\.id\)/);
  });

  it("counts only the first five Soul Trace answers as memories", () => {
    assert.match(page, /soul_trace_submission_answers/);
    assert.match(page, /\.lte\("answer_order", 5\)/);
  });

  it("uses server data and removes fictional Phase 1 content", () => {
    assert.match(page, /generated_letter/);
    assert.match(page, /pet_name/);
    assert.doesNotMatch(preview, /EXAMPLE_|Coco|Phase 1 fixture/);
    assert.doesNotMatch(preview, /type="file"|<video/i);
  });

  it("keeps saved letter text independent from interface locale", () => {
    assert.match(preview, /exactLetterParagraphs\(archive\.letter\)/);
    assert.match(preview, /archive\.generationLocale === "ko"/);
    assert.doesNotMatch(preview, /t\([^\n]*archive\.letter/);
  });

  it("does not add photo or video controls to the archive", () => {
    assert.doesNotMatch(preview, /type="file"|<video/i);
  });

  it("renders the transparent pet wallpaper as a decorative scrolling layer", () => {
    assert.match(preview, /life-archive-pets-overlay\.png/);
    assert.match(preview, /aria-hidden="true"/);
    assert.match(preview, /pointer-events-none/);
    assert.match(preview, /select-none/);
    assert.match(preview, /object-contain/);
    assert.match(preview, /maskImage/);
    assert.match(preview, /relative z-10/);
  });

  it("carries selection through the verified email callback", () => {
    assert.match(access, /PENDING_LETTER_COOKIE/);
    assert.match(confirmation, /claim_soul_trace_legacy_records/);
    assert.match(callback, /ACTIVE_SUBMISSION_COOKIE/);
  });
});
