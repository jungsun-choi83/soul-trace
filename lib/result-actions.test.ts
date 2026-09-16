import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("result download and Instagram actions", () => {
  it("reuses the ambient sparkle layer behind result content", () => {
    assert.match(
      source,
      /\{result \? \([\s\S]*?<main[\s\S]*?<WarmRisingSparkles \/>[\s\S]*?<section className="relative z-\[2\]/,
    );
    assert.match(source, /<header className="relative z-\[2\]/);
  });

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

  it("offers an accessible result back arrow with a safe fallback", () => {
    assert.match(source, /onClick=\{goBackFromResult\}/);
    assert.match(source, /aria-label=\{t\("landing\.navBack"\)\}/);
    assert.match(source, /<span>\{t\("landing\.navBack"\)\}<\/span>/);
    assert.match(source, /if \(!initialResult\) \{[\s\S]*?setResult\(null\);[\s\S]*?return;/);
    assert.match(source, /window\.history\.back\(\)/);
    assert.match(source, /window\.location\.assign\(letterModePath\(mode\)\)/);
    assert.doesNotMatch(source, /window\.location\.assign\("\/choose"\)/);
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
    const archive = source.indexOf("onClick={handleLifeArchiveJourney}");
    assert.ok(instagram >= 0 && instagram < archive);
    assert.doesNotMatch(
      source.slice(instagram, archive),
      /result\.letterId\s*&&\s*!result\.persistenceFailed\s*\?\s*\(/,
    );
    assert.match(
      source,
      /hasEternalBeamAccess && SECURE_LIFE_ARCHIVE_CONFIGURED && \(!result\.letterId \|\| result\.persistenceFailed\)/,
    );
  });

  it("uses a session-only archive while Supabase is not configured", () => {
    assert.match(source, /if \(!SECURE_LIFE_ARCHIVE_CONFIGURED\)/);
    assert.match(source, /saveTemporaryLifeArchive\(\{/);
    assert.match(source, /new URL\("\/life-archive", window\.location\.origin\)/);
    assert.match(source, /searchParams\.set\("from", "letter"\)/);
    assert.match(source, /searchParams\.set\("returnTo"/);
    assert.doesNotMatch(source, /sessionStorage\.setItem\([\s\S]*userEmail/);
  });

  it("keeps download preparation state separate from Instagram sharing", () => {
    assert.match(source, /setIsDownloading\(true\)/);
    assert.match(source, /finally\s*\{\s*setIsDownloading\(false\)/);
    assert.match(source, /isDownloading \? t\("result.preparingImage"\)/);
  });

  it("shows one accessible Instagram icon without changing the share action", () => {
    assert.equal(source.match(/<InstagramIcon \/>/g)?.length, 1);
    assert.match(source, /function InstagramIcon\(\)[\s\S]*?aria-hidden="true"/);
    assert.match(source, /<InstagramIcon \/>[\s\S]*?t\("result\.instagramShareButton"\)/);
    assert.equal(source.match(/onClick=\{onInstagramButtonClick\}/g)?.length, 1);
  });

  it("opens generic Instagram without duplicating the letter download", () => {
    assert.match(source, /openInstagramWebsite/);
    assert.doesNotMatch(source, /shareNotice|desktopOpened/);
    assert.doesNotMatch(source, /downloadThenOpenInstagramTab/);
    assert.doesNotMatch(source, /downloadForManualInstagramUpload/);
    assert.doesNotMatch(source, /window\.open\(instagramProfileUrl/);
    assert.match(source, /window\.open\("https:\/\/www\.instagram\.com\/"/);
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
