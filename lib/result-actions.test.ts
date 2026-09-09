import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("result download and Instagram actions", () => {
  const source = readFileSync("components/soul-trace-flow.tsx", "utf8");

  it("orders heading, download, Instagram, and start-over controls", () => {
    const heading = source.indexOf('t("result.instagramShareLead")');
    const download = source.indexOf("onClick={handleDownloadImage}");
    const instagram = source.indexOf("onClick={onInstagramButtonClick}");
    const startOver = source.indexOf("onClick={resetTest}");

    assert.ok(heading >= 0 && heading < download);
    assert.ok(download < instagram);
    assert.ok(instagram < startOver);
    assert.equal(source.match(/onClick=\{handleDownloadImage\}/g)?.length, 1);
  });

  it("enforces identical responsive measurements through one shared class", () => {
    assert.match(
      source,
      /RESULT_ACTION_BUTTON_SIZE_CLASS\s*=\s*\n\s*"flex min-h-\[56px\] w-full items-center justify-center rounded-xl px-5 py-4 text-center text-sm font-light sm:text-base"/,
    );
    assert.equal(source.split("${RESULT_ACTION_BUTTON_SIZE_CLASS}").length - 1, 3);
    assert.match(source, /<div className="space-y-3">/);
  });

  it("always shows Life Archive directly below Instagram", () => {
    const instagram = source.indexOf("onClick={onInstagramButtonClick}");
    const archive = source.indexOf("onClick={continueToLifeArchive}");
    assert.ok(instagram >= 0 && instagram < archive);
    assert.doesNotMatch(
      source.slice(instagram, archive),
      /result\.letterId\s*&&\s*!result\.persistenceFailed\s*\?\s*\(/,
    );
    assert.match(
      source,
      /SECURE_LIFE_ARCHIVE_CONFIGURED &&\s*\(!result\.letterId \|\| result\.persistenceFailed\)/,
    );
  });

  it("uses a session-only archive while Supabase is not configured", () => {
    assert.match(source, /if \(!SECURE_LIFE_ARCHIVE_CONFIGURED\)/);
    assert.match(source, /saveTemporaryLifeArchive\(\{/);
    assert.match(source, /window\.location\.assign\("\/life-archive"\)/);
    assert.doesNotMatch(source, /sessionStorage\.setItem\([\s\S]*userEmail/);
  });

  it("keeps download preparation state separate from Instagram sharing", () => {
    assert.match(source, /setIsDownloading\(true\)/);
    assert.match(source, /finally\s*\{\s*setIsDownloading\(false\)/);
    assert.match(source, /isDownloading \? t\("result.preparingImage"\)/);
  });

  it("uses the required English and Korean localized labels", () => {
    const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
    const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

    assert.equal(en.result.instagramShareLead, "Keep this moment with you");
    assert.equal(en.result.keepForever, "Keep This Letter");
    assert.equal(en.result.instagramShareButton, "Share to Instagram Stories");
    assert.equal(ko.result.instagramShareLead, "이 순간을 간직하세요");
    assert.equal(ko.result.keepForever, "이 편지를 간직하기");
    assert.equal(ko.result.instagramShareButton, "인스타그램 스토리에 공유하기");
  });
});
