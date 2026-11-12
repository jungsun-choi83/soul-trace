import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { polaroidFrameLayout } from "./polaroid-frames.ts";

const sharedFrame = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");
const entry = readFileSync("components/polaroid-entry.tsx", "utf8");
const gallery = readFileSync("components/my-polaroids-page.tsx", "utf8");
const EN_BODY_LIMIT = 40;
const KO_BODY_LIMIT = 22;
const EN_EM_PER_CHAR = 0.47;
const KO_EM_PER_CHAR = 0.85;
const FRAME_CAPTION_FONT_RATIO = 0.029;
const HALLOWEEN_CAPTION_FONT_RATIO = 0.025;
const LINE_HEIGHT = 1.1;

test("caption uses each frame's safe area and a readable container-relative size", () => {
  assert.match(sharedFrame, /className=\{`@container \$\{frameClassName\}`\}/);
  assert.match(sharedFrame, /text-\[2\.9cqw\] font-semibold leading-\[1\.1\]/);
  assert.match(sharedFrame, /fontSize: layout\.halloweenDecor \? "2\.5cqw" : layout\.captionFontSize \?\? CAPTION_FONT_SIZE/);
  assert.match(sharedFrame, /color: layout\.captionTextColor \?\? "#49372A"/);
  assert.match(sharedFrame, /left: layout\.caption\.left,[\s\S]*?top: layout\.caption\.top,[\s\S]*?bottom: layout\.caption\.bottom/);
  assert.match(sharedFrame, /layout\.flowers \? "" : "flex items-center justify-center"/);
  assert.match(sharedFrame, /CAPTION_LEFT_FLOWER_SHAPE/);
  assert.match(sharedFrame, /CAPTION_RIGHT_FLOWER_SHAPE/);
  assert.match(entry, /<SeasonalPolaroidFrame/);
  assert.doesNotMatch(entry, /text-\[2\.9cqw\]|CAPTION_LEFT_FLOWER_SHAPE/);
  assert.match(gallery, /<SeasonalPolaroidFrame/);
  assert.doesNotMatch(gallery, /text-\[2\.9cqw\]/);
});

test("all four templates separate the photo window and support max English and Korean lines", () => {
  for (const [id, theme] of [["halloween", "halloween"], ["felt", "felt-doll"], ["gouache", "gouache-story"], ["crayon", "crayon-diary"]]) {
    const layout = polaroidFrameLayout(theme);
    const photoBottom = Number.parseFloat(layout.photo.top) + Number.parseFloat(layout.photo.height);
    const captionTop = Number.parseFloat(layout.caption.top);
    const captionHeight = 1 - captionTop / 100 - Number.parseFloat(layout.caption.bottom) / 100;
    const captionWidth = 1 - Number.parseFloat(layout.caption.left) / 100 - Number.parseFloat(layout.caption.right) / 100;
    const fontRatio = id === "halloween" || layout.captionFontSize === "2.5cqw" ? HALLOWEEN_CAPTION_FONT_RATIO : FRAME_CAPTION_FONT_RATIO;
    assert.ok(captionTop - photoBottom >= 1, `${id}: photo/caption gap is too small`);

    for (const width of [300, 350, 390, 430, 440]) {
      const fittingFont = width * fontRatio * 0.8;
      assert.ok(EN_BODY_LIMIT * EN_EM_PER_CHAR * fittingFont <= width * captionWidth, `${id}: max English line exceeds its caption width at ${width}px`);
      assert.ok(KO_BODY_LIMIT * KO_EM_PER_CHAR * fittingFont <= width * captionWidth, `${id}: max Korean line exceeds its caption width at ${width}px`);
      const fourLineHeight = 4 * width * fontRatio / 1.5 * LINE_HEIGHT;
      assert.ok(fourLineHeight <= width * 1.5 * captionHeight, `${id}: four max-length lines exceed caption height at ${width}px`);
    }
  }
});

test("caption sizing has a readable floor for new frames and retains Halloween compatibility", () => {
  assert.match(sharedFrame, /export const CAPTION_FONT_SIZE = "2\.9cqw";/);
  assert.match(sharedFrame, /export const CAPTION_FIT_MIN = 0\.8;/);
  assert.ok(350 * FRAME_CAPTION_FONT_RATIO * 0.8 >= 8, "new frame phone caption floor should be at least 8px");
  assert.ok(430 * FRAME_CAPTION_FONT_RATIO * 0.8 >= 9.9, "new frame result caption floor should be at least 9.9px");
  assert.ok(350 * HALLOWEEN_CAPTION_FONT_RATIO * 0.8 >= 7, "Halloween keeps its existing caption floor");
});

test("caption lines fit without changing their text and split only an over-long greeting", async () => {
  assert.match(sharedFrame, /^"use client";/);
  assert.match(sharedFrame, /export function fitCaptionLines\(memo: HTMLElement\): boolean/);
  assert.match(sharedFrame, /while \(factor > CAPTION_FIT_MIN \+ 1e-9 && visualLineCount\(paragraph\) > 1\)/);
  assert.match(sharedFrame, /paragraph\.style\.fontSize = `\$\{baseFontPx \* factor\}px`/);
  assert.match(sharedFrame, /if \(!fitCaptionLines\(memo\) && !greetingSplit && splitCaptionGreeting\(memoLines\[0\] \?\? ""\)\) setSplit\(\{ key: memoKey, value: true \}\)/);
  assert.match(sharedFrame, /const greetingSplit = split\.key === memoKey && split\.value;/);
  assert.match(sharedFrame, /document\.fonts\.ready\.then\(fit\)/);
  assert.match(sharedFrame, /\{displayLines\.map\(\(line, index\)/);

  const source = sharedFrame
    .replace(/^"use client";/m, "")
    .replace(/import type \{ Locale \} from "@\/lib\/i18n";/, "")
    .replace(/import \{ polaroidFrameLayout \} from "@\/lib\/polaroid-frames";/, "")
    .replace(/import \{[^}]*\} from "react";/, "")
    .replace(/export function SeasonalPolaroidFrame[\s\S]*$/m, "");
  const { stripTypeScriptTypes } = await import("node:module") as unknown as { stripTypeScriptTypes: (code: string, options: { mode: "strip" }) => string };
  const captionModule = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`) as {
    splitCaptionGreeting: (greeting: string) => [string, string] | null;
    captionDisplayLines: (lines: string[], split: boolean) => string[];
  };
  assert.deepEqual(captionModule.splitCaptionGreeting("엄마와 아빠, 부부의 가장 큰 팬"), ["엄마와 아빠,", "부부의 가장 큰 팬"]);
  assert.deepEqual(captionModule.splitCaptionGreeting("Mom and Dad, happy Halloween from Maximiliano1!"), ["Mom and Dad,", "happy Halloween from Maximiliano1!"]);
  assert.equal(captionModule.splitCaptionGreeting("Bubu!"), null);
  const originalLines = ["Mom and Dad, Bubu loves our sunny home!", "I love our slow morning walks together,", "warm sunshine and my favorite treats,", "every cozy moment feels safe beside you."];
  assert.deepEqual(captionModule.captionDisplayLines(originalLines, false), originalLines);
  assert.deepEqual(captionModule.captionDisplayLines(originalLines, true).join(" "), originalLines.join(" "));
});
