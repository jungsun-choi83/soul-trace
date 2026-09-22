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
  const kickstarterPromo = readFileSync("components/homepage/kickstarter-promo.tsx", "utf8");

  it("places download and share directly below the letter before lower result sections", () => {
    const letter = source.indexOf('id="share-card"');
    const download = source.indexOf("onClick={handleDownloadImage}");
    const share = source.indexOf("aria-controls=\"letter-share-tray\"");
    const productCards = source.indexOf('aria-label={t("result.productCards.label")}');

    assert.ok(letter >= 0 && letter < download);
    assert.ok(download < share);
    assert.ok(share < productCards);
    assert.equal(source.match(/onClick=\{handleDownloadImage\}/g)?.length, 1);
    assert.equal(source.match(/action: onInstagramButtonClick/g)?.length, 1);
    assert.doesNotMatch(source, /result\.emotionalBridge/);
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

  it("uses equal-height responsive letter actions", () => {
    assert.ok(source.split("min-h-[52px]").length - 1 >= 2);
    assert.match(source, /grid-cols-1 gap-3 sm:grid-cols-2/);
  });

  it("removes the four retired result-page boxes", () => {
    assert.doesNotMatch(source, /handleLifeArchiveJourney/);
    assert.doesNotMatch(source, /continueToEternalBeam/);
    assert.doesNotMatch(source, /result\.destinationDeck\.officialSite/);
    assert.doesNotMatch(source, /result\.destinationDeck\.instagram/);
  });

  it("does not show the pet year range between product cards and the banner", () => {
    assert.doesNotMatch(source, /petProfilePayload\.yearMet.*petProfilePayload\.yearParted/);
  });

  it("keeps download preparation state separate from Instagram sharing", () => {
    assert.match(source, /setIsDownloading\(true\)/);
    assert.match(source, /finally\s*\{\s*setIsDownloading\(false\)/);
    assert.match(source, /isDownloading \? t\("result.preparingImage"\)/);
  });

  it("shows accessible download and share icons without changing either action", () => {
    assert.equal(source.match(/<DownloadIcon \/>/g)?.length, 1);
    assert.equal(source.match(/<ShareIcon \/>/g)?.length, 1);
    assert.match(source, /function DownloadIcon\(\)[\s\S]*?aria-hidden="true"/);
    assert.match(source, /function ShareIcon\(\)[\s\S]*?aria-hidden="true"/);
    assert.match(source, /<DownloadIcon \/>[\s\S]*?t\("result\.keepForever"\)/);
    assert.match(source, /<ShareIcon \/>[\s\S]*?t\("result\.instagramShareButton"\)/);
    assert.equal(source.match(/action: onInstagramButtonClick/g)?.length, 1);
  });

  it("expands an accessible, reduced-motion-aware share tray", () => {
    assert.match(source, /aria-expanded=\{shareTrayOpen\}/);
    assert.match(source, /aria-controls="letter-share-tray"/);
    assert.match(source, /duration: prefersReducedMotion \? 0 : 0\.32/);
    assert.match(source, /delay: prefersReducedMotion \? 0 : 0\.1 \+ index \* 0\.04/);
    assert.match(source, /document\.addEventListener\("pointerdown", closeShareTray\)/);
  });

  it("uses real supported brand icons and valid share destinations", () => {
    assert.match(source, /FaInstagram/);
    assert.match(source, /FaTiktok/);
    assert.match(source, /FaFacebookF/);
    assert.match(source, /SiKakaotalk/);
    assert.match(source, /FaLine/);
    assert.match(source, /HiOutlineLink/);
    assert.match(source, /facebook\.com\/sharer\/sharer\.php/);
    assert.match(source, /social-plugins\.line\.me\/lineit\/share/);
    assert.match(source, /navigator\.clipboard\.writeText/);
  });

  it("replaces the old Eternal Beam preview with compact product cards", () => {
    assert.doesNotMatch(source, /<EternalBeamPreview/);
    assert.match(source, /src="\/images\/letter-keepsake-result\.png"/);
    assert.match(source, /src="\/images\/eternal-beam-result\.png"/);
    assert.match(source, /grid-cols-1 gap-4 sm:grid-cols-2/);
    assert.match(source, /href=\{officialSiteUrl\}/);
  });

  it("keeps the responsive Kickstarter artwork near the end of the result flow", () => {
    const productCards = source.indexOf('aria-label={t("result.productCards.label")}');
    const banner = source.indexOf("<KickstarterPromo fullBleed compact />");
    const retry = source.indexOf("onClick={resetTest}");

    assert.ok(productCards >= 0 && productCards < banner);
    assert.ok(banner < retry);
    assert.match(kickstarterPromo, /comingsoon-ko\.png/);
    assert.match(kickstarterPromo, /comingsoon\.png/);
    assert.match(kickstarterPromo, /fetch\("\/api\/kickstarter-waitlist"/);
    assert.match(kickstarterPromo, /homepage\.kickstarter\.success/);
    assert.match(kickstarterPromo, /KICKSTARTER_URL \? \([\s\S]*?href=\{KICKSTARTER_URL\}[\s\S]*?\) : \([\s\S]*?<button/);
    assert.match(kickstarterPromo, /w-screen \[margin-inline:calc\(50%_-_50vw\)\]/);
    assert.match(source, /aria-label="Follow Eternal Beam on Instagram"/);
    assert.match(source, /aria-label="Follow Eternal Beam on Facebook"/);
    assert.match(source, /aria-label="Follow Eternal Beam on YouTube"/);
    assert.match(source, /<FaYoutube aria-hidden="true"/);
    assert.match(source, />Follow our journey<\/span>/);
    assert.match(source, /radial-gradient\(circle_at_32%_100%/);
    assert.match(source, /bg-\[#1877F2\]/);
    assert.match(source, /bg-\[#FF0000\]/);
    assert.doesNotMatch(source, /TikTok link not configured|YouTube link not configured/);
    assert.match(source, /© 2026 Eternal Beam\. All rights reserved\./);
    assert.doesNotMatch(source, /© 2026 Eternal Beam\. 모든 권리 보유\./);
  });

  it("opens the official Eternal Beam Instagram without duplicating the letter download", () => {
    assert.match(source, /openInstagramWebsite/);
    assert.doesNotMatch(source, /shareNotice|desktopOpened/);
    assert.doesNotMatch(source, /downloadThenOpenInstagramTab/);
    assert.doesNotMatch(source, /downloadForManualInstagramUpload/);
    assert.match(source, /window\.open\(instagramProfileUrl/);
    assert.doesNotMatch(source, /window\.open\("https:\/\/www\.instagram\.com\/"/);
    const urls = readFileSync("lib/eternalbeam-urls.ts", "utf8");
    assert.match(urls, /return "https:\/\/www\.instagram\.com\/eternalbeam_official\/"/);
    assert.doesNotMatch(urls, /NEXT_PUBLIC_ETERNALBEAM_INSTAGRAM_URL/);
  });

  it("uses the required English and Korean localized labels", () => {
    const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
    const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

    assert.equal(en.result.keepForever, "Download this letter");
    assert.equal(en.result.instagramShareButton, "Share this letter");
    assert.equal(ko.result.keepForever, "이 편지 다운로드하기");
    assert.equal(ko.result.instagramShareButton, "이 편지 공유하기");
  });
});
