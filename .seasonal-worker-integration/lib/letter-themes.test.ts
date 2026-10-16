import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  DEFAULT_LETTER_THEME_ID,
  getLetterTheme,
  isLetterThemeId,
  LETTER_THEMES,
} from "./letter-themes.ts";

describe("편지 미리보기 테마", () => {
  it("요청한 네 테마와 정확한 public 경로를 한 설정에 둔다", () => {
    assert.deepEqual(
      LETTER_THEMES.map(({ id, backgroundImage }) => ({ id, backgroundImage })),
      [
        { id: "golden-meadow", backgroundImage: "/backgrounds/golden-meadow.jpg" },
        { id: "night-sky", backgroundImage: "/backgrounds/night-sky.jpg" },
        { id: "soft-clouds", backgroundImage: "/backgrounds/soft-clouds.jpg" },
        { id: "memory-paper", backgroundImage: "/backgrounds/memory-paper.jpg" },
      ],
    );
  });

  it("각 테마는 글꼴·대비 패널·제목·드롭캡 색을 모두 가진다", () => {
    for (const theme of LETTER_THEMES) {
      assert.match(theme.fontFamily, /var\(--font-/);
      assert.ok(theme.textColor);
      assert.match(theme.overlayColor, /^rgba\(/);
      assert.ok(theme.headingColor);
      assert.ok(theme.dropCapColor);
      assert.ok(theme.fallbackBackground.includes("gradient"));
    }
    assert.equal(getLetterTheme(DEFAULT_LETTER_THEME_ID).id, "golden-meadow");
    assert.equal(isLetterThemeId("night-sky"), true);
    assert.equal(isLetterThemeId("unknown"), false);
  });

  it("선택 UI는 캡처 밖이고 테마 속성은 편지 미리보기에만 붙는다", () => {
    const source = readFileSync("components/soul-trace-flow.tsx", "utf8");
    const selector = source.indexOf("data-letter-style-selector");
    const capture = source.indexOf("ref={captureRef}");
    const scopedTheme = source.indexOf("data-letter-preview-theme={letterTheme.id}");
    const lowerControls = source.indexOf('t("result.keepForever")');

    assert.ok(selector >= 0 && selector < capture, "selector must stay outside exported preview");
    assert.ok(scopedTheme > capture, "theme must be scoped to the capture preview");
    assert.ok(lowerControls > scopedTheme, "download and regenerate controls remain below preview");
    assert.equal(source.match(/data-letter-preview-theme=/g)?.length, 1);
    assert.match(
      source,
      /relative z-\[1\] min-h-screen pb-10[\s\S]*?showChannelBackground \? "bg-transparent" : "bg-black"/,
    );
    assert.match(source, /data-letter-style-selector[\s\S]*?overflow-x-auto/);
    assert.doesNotMatch(source, /max-h-\[860px\]/);
    assert.doesNotMatch(source, /data-letter-scroll[\s\S]*?overflow-y-auto/);
  });

  it("앱의 기존 배경 토큰은 정확히 #000000 이다", () => {
    const css = readFileSync("app/globals.css", "utf8");
    assert.match(css, /--background:\s*#000000;/);
    assert.match(css, /body\s*\{[\s\S]*?background:\s*var\(--background\)/);
  });
});

describe("letter theme background assets", () => {
  it("ships every configured background as a complete JPEG", () => {
    for (const theme of LETTER_THEMES) {
      const assetPath = `public${theme.backgroundImage}`;
      assert.equal(existsSync(assetPath), true, `${assetPath} must exist`);

      const bytes = readFileSync(assetPath);
      assert.ok(bytes.length > 4, `${assetPath} must not be empty`);
      assert.deepEqual([...bytes.subarray(0, 2)], [0xff, 0xd8], `${assetPath} must be a JPEG`);
      assert.deepEqual([...bytes.subarray(-2)], [0xff, 0xd9], `${assetPath} must be complete`);
    }
  });
});

describe("download-safe font loading", () => {
  it("does not expose a cross-origin Google Fonts stylesheet to html-to-image", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");

    assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
    assert.match(layout, /Noto_Serif_KR/);
    assert.match(layout, /Nanum_Myeongjo/);
    assert.match(css, /var\(--font-noto-serif-kr\)/);
  });
});
