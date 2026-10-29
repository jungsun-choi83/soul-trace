import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sharedFrame = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");
const entry = readFileSync("components/polaroid-entry.tsx", "utf8");
const gallery = readFileSync("components/my-polaroids-page.tsx", "utf8");

// Geometry of the caption window inside the 2:3 template, as rendered by both
// frame components: 19% inset on each side, from 70.6% (below the paw
// ornament) to 81% (above the SOUL TRACE divider) of the height. Float shapes
// carve the flower clusters out of that box. Measured on the template: rows
// used by the first four lines keep at least 47.5% of the frame width clear;
// the lowest rows, used only by a wrapped fifth line, keep about 42%.
const WINDOW_WIDTH_RATIO = 1 - 0.19 * 2;
const WINDOW_HEIGHT_RATIO = (1 - 0.19) - 0.706;
const FOURTH_LINE_CLEAR_RATIO = 0.475;
const NARROWEST_CLEAR_RATIO = 0.417;
const FONT_RATIO = 0.025; // text-[2.5cqw]
const LINE_HEIGHT = 1.1;
// Average advance widths measured in headless Chrome with the real fonts:
// Marcellus mixed-case caption text runs 0.44-0.46em per character, Korean
// serif glyphs are full-width. 0.47 keeps a margin for capital-heavy lines.
// Korean caption lines measured 0.66-0.78em per character including spaces
// and punctuation (a 21-character worst-case line spanned 34.8% of the frame
// at 2.5cqw); 0.85 keeps a margin for lines with no spaces at all.
const EN_EM_PER_CHAR = 0.47;
const KO_EM_PER_CHAR = 0.85;
const EN_BODY_LIMIT = 40;
const KO_BODY_LIMIT = 22;

test("caption text scales with the Polaroid frame, not the viewport, in the one shared composition", () => {
  assert.match(sharedFrame, /className=\{`@container \$\{frameClassName\}`\}/);
  assert.match(sharedFrame, /text-\[2\.5cqw\] leading-\[1\.1\]/);
  assert.doesNotMatch(sharedFrame, /clamp\(0\.42rem/);
  assert.match(sharedFrame, /bottom-\[19%\] left-\[19%\] right-\[19%\] top-\[70\.6%\]/);
  assert.match(sharedFrame, /CAPTION_LEFT_FLOWER_SHAPE/);
  assert.match(sharedFrame, /CAPTION_RIGHT_FLOWER_SHAPE/);
  // Top-aligned block: no flex centring that would hide the greeting when a line wraps.
  assert.doesNotMatch(sharedFrame, /top-\[70\.6%\] z-20 flex items-center/);
  assert.match(sharedFrame, /shape-outside:polygon\(0_0,30%_0/);
  assert.match(sharedFrame, /shape-outside:polygon\(18%_0,100%_0/);
  // The result page and the gallery render that component rather than their own copies.
  assert.match(entry, /<SeasonalPolaroidFrame/);
  assert.doesNotMatch(entry, /text-\[2\.5cqw\]|top-\[70\.6%\]|CAPTION_LEFT_FLOWER_SHAPE/);
  assert.match(gallery, /<SeasonalPolaroidFrame/);
  assert.doesNotMatch(gallery, /text-\[2\.5cqw\]|top-\[70\.6%\]/);
});

test("four maximum-length lines fit the caption window at phone, gallery, and desktop widths", () => {
  for (const frameWidth of [300, 350, 390, 430, 440]) {
    const font = frameWidth * FONT_RATIO;
    const windowWidth = frameWidth * WINDOW_WIDTH_RATIO;
    const windowHeight = frameWidth * 1.5 * WINDOW_HEIGHT_RATIO;
    assert.ok(EN_BODY_LIMIT * EN_EM_PER_CHAR * font <= windowWidth, `EN line overflows at ${frameWidth}px`);
    assert.ok(KO_BODY_LIMIT * KO_EM_PER_CHAR * font <= windowWidth, `KO line overflows at ${frameWidth}px`);
    // Four maximum-length lines occupy rows that keep 47.5% of the frame clear.
    assert.ok(4 * font * LINE_HEIGHT <= frameWidth * 1.5 * (0.780 - 0.706), `four lines reach the narrow flower rows at ${frameWidth}px`);
    assert.ok(EN_BODY_LIMIT * EN_EM_PER_CHAR * font <= frameWidth * FOURTH_LINE_CLEAR_RATIO, `max EN line overlaps flowers at ${frameWidth}px`);
    assert.ok(KO_BODY_LIMIT * KO_EM_PER_CHAR * font <= frameWidth * FOURTH_LINE_CLEAR_RATIO, `max KO line overlaps flowers at ${frameWidth}px`);
    // Typical lines (the prompt's 28-34 / 14-18 targets) fit even the narrowest rows.
    assert.ok(34 * EN_EM_PER_CHAR * font <= frameWidth * NARROWEST_CLEAR_RATIO, `typical EN line overlaps flowers at ${frameWidth}px`);
    assert.ok(18 * KO_EM_PER_CHAR * font <= frameWidth * NARROWEST_CLEAR_RATIO, `typical KO line overlaps flowers at ${frameWidth}px`);
    // Room for the four lines plus one wrapped line, in case a greeting runs long.
    assert.ok(5 * font * LINE_HEIGHT <= windowHeight, `five lines overflow at ${frameWidth}px`);
  }
});

test("mobile caption size is larger than before while desktop stays within the old ceiling", () => {
  const phone = 350 * FONT_RATIO;
  const previousPhoneMinimum = 0.42 * 16;
  const previousDesktopMaximum = 0.68 * 16;
  assert.ok(phone > previousPhoneMinimum * 1.25, `phone size ${phone}px should be clearly larger than ${previousPhoneMinimum}px`);
  assert.ok(430 * FONT_RATIO <= previousDesktopMaximum, "desktop size must not exceed what the window was tuned for");
});

test("caption lines are fitted on screen down to a readability floor, then the greeting splits", () => {
  assert.match(sharedFrame, /^"use client";/);
  assert.match(sharedFrame, /export const CAPTION_FIT_MIN = 0\.8;/);
  assert.match(sharedFrame, /export function fitCaptionLines\(memo: HTMLElement\): boolean/);
  assert.match(sharedFrame, /while \(factor > CAPTION_FIT_MIN \+ 1e-9 && visualLineCount\(paragraph\) > 1\)/);
  assert.match(sharedFrame, /paragraph\.style\.fontSize = `calc\(\$\{CAPTION_FONT_SIZE\} \* \$\{factor\}\)`/);
  assert.match(sharedFrame, /if \(!fitCaptionLines\(memo\) && !greetingSplit && splitCaptionGreeting\(memoLines\[0\] \?\? ""\)\) setSplit\(\{ key: memoKey, value: true \}\)/);
  // The split belongs to one caption: a new caption (new memoKey) starts unsplit without an effect.
  assert.match(sharedFrame, /const greetingSplit = split\.key === memoKey && split\.value;/);
  assert.doesNotMatch(sharedFrame, /useEffect\(/);
  assert.match(sharedFrame, /document\.fonts\.ready\.then\(fit\)/);
  assert.match(sharedFrame, /\{displayLines\.map\(\(line, index\)/);
  // The size stays container-relative after fitting, so a resized card keeps the same fit.
  assert.doesNotMatch(sharedFrame, /style\.fontSize = "\d/);
  // Floor sizes: 80% of 2.5% of the frame width.
  assert.ok(350 * 0.025 * 0.8 >= 7, "phone floor is at least 7px");
  assert.ok(430 * 0.025 * 0.8 >= 8.6, "result page floor is at least 8.6px");
});

test("an over-long greeting splits after the call name, otherwise at the middle space", async () => {
  const source = sharedFrame
    .replace(/^"use client";/m, "")
    .replace(/import type \{ Locale \} from "@\/lib\/i18n";/, "")
    .replace(/import \{[^}]*\} from "react";/, "")
    .replace(/export function SeasonalPolaroidFrame[\s\S]*$/m, "");
  const { stripTypeScriptTypes } = await import("node:module") as unknown as { stripTypeScriptTypes: (code: string, options: { mode: "strip" }) => string };
  const captionModule = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source, { mode: "strip" }))}`) as {
    splitCaptionGreeting: (greeting: string) => [string, string] | null;
    captionDisplayLines: (lines: string[], split: boolean) => string[];
  };
  assert.deepEqual(captionModule.splitCaptionGreeting("엄마와 아빠, 뚜리뚜리뚜리뚜리뚜리뚜리야! 해피 할로윈!"), ["엄마와 아빠,", "뚜리뚜리뚜리뚜리뚜리뚜리야! 해피 할로윈!"]);
  assert.deepEqual(captionModule.splitCaptionGreeting("Mom and Dad, happy Halloween from Maximiliano1!"), ["Mom and Dad,", "happy Halloween from Maximiliano1!"]);
  assert.deepEqual(captionModule.splitCaptionGreeting("Grandma happy Halloween from Tuli!"), ["Grandma happy", "Halloween from Tuli!"]);
  assert.equal(captionModule.splitCaptionGreeting("Tuli!"), null);
  assert.deepEqual(captionModule.captionDisplayLines(["Mom, hi from Tuli!", "a", "b", "c"], false), ["Mom, hi from Tuli!", "a", "b", "c"]);
  assert.deepEqual(captionModule.captionDisplayLines(["Mom, hi from Tuli!", "a", "b", "c"], true), ["Mom,", "hi from Tuli!", "a", "b", "c"]);
});
