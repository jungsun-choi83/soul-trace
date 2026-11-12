import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CRAYON_POLAROID_FRAME_SRC,
  FELT_POLAROID_FRAME_SRC,
  GOUACHE_POLAROID_FRAME_SRC,
  HALLOWEEN_POLAROID_FRAME_SRC,
  SEASONAL_POLAROID_FRAME_THEME_IDS,
  isPolaroidFrameThemeKnown,
  polaroidFrameLayout,
  resolvePolaroidFrameThemeId,
} from "./polaroid-frames.ts";
import { POLAROID_THEME_IDS } from "./polaroid-themes.ts";

const entry = readFileSync("components/polaroid-entry.tsx", "utf8");
const gallery = readFileSync("components/my-polaroids-page.tsx", "utf8");
const frame = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");

const ART_STYLE_FRAMES: Array<[string, string]> = [
  ["felt-doll", FELT_POLAROID_FRAME_SRC],
  ["gouache-story", GOUACHE_POLAROID_FRAME_SRC],
  ["crayon-diary", CRAYON_POLAROID_FRAME_SRC],
];

test("each art style keeps its own customized frame", () => {
  for (const [themeId, expected] of ART_STYLE_FRAMES) {
    assert.equal(polaroidFrameLayout(themeId).templateSrc, expected, `${themeId} frame`);
    assert.notEqual(polaroidFrameLayout(themeId).templateSrc, HALLOWEEN_POLAROID_FRAME_SRC, `${themeId} must not fall back to the seasonal template`);
  }
  // The three are distinct from one another.
  assert.equal(new Set(ART_STYLE_FRAMES.map(([id]) => polaroidFrameLayout(id).templateSrc)).size, 3);
});

test("genuine Halloween and other seasonal Polaroids keep the seasonal frame", () => {
  for (const themeId of SEASONAL_POLAROID_FRAME_THEME_IDS) {
    assert.equal(polaroidFrameLayout(themeId).templateSrc, HALLOWEEN_POLAROID_FRAME_SRC, `${themeId} must keep the seasonal template`);
  }
  assert.equal(polaroidFrameLayout("halloween").id, "halloween");
});

test("every registered theme id resolves to a deliberate frame", () => {
  // No saved Polaroid can land on an unrecognised branch.
  for (const themeId of POLAROID_THEME_IDS) {
    assert.equal(isPolaroidFrameThemeKnown(themeId), true, `${themeId} must be a known frame theme`);
  }
  assert.equal(
    POLAROID_THEME_IDS.length,
    SEASONAL_POLAROID_FRAME_THEME_IDS.length + ART_STYLE_FRAMES.length,
    "a new theme needs a frame decision",
  );
});

test("absent or invalid frame metadata is reported as unknown, not as Halloween", () => {
  for (const value of [null, undefined, "", "   ", "not-a-theme"]) {
    assert.equal(isPolaroidFrameThemeKnown(value), false, `${JSON.stringify(value)} must not count as a known theme`);
  }
  // Surrounding whitespace must not change a real choice into the fallback.
  assert.equal(polaroidFrameLayout(" felt-doll ").templateSrc, FELT_POLAROID_FRAME_SRC);
  assert.equal(isPolaroidFrameThemeKnown(" gouache-story "), true);
});

test("saved result metadata wins over the in-progress questionnaire draft", () => {
  // The reported bug: a saved art-style Polaroid viewed on a resumed session,
  // where the draft has been reset to empty.
  assert.equal(resolvePolaroidFrameThemeId("gouache-story", ""), "gouache-story");
  assert.equal(resolvePolaroidFrameThemeId("felt-doll", "halloween"), "felt-doll");
  assert.equal(resolvePolaroidFrameThemeId("crayon-diary", null), "crayon-diary");
  // A genuine Halloween result is still Halloween.
  assert.equal(resolvePolaroidFrameThemeId("halloween", "felt-doll"), "halloween");
  // Still being made: no saved result yet, so the draft is all there is.
  assert.equal(resolvePolaroidFrameThemeId(null, "felt-doll"), "felt-doll");
  assert.equal(resolvePolaroidFrameThemeId(undefined, "crayon-diary"), "crayon-diary");
  // Neither available reports unknown rather than guessing.
  assert.equal(resolvePolaroidFrameThemeId(null, null), null);
  assert.equal(resolvePolaroidFrameThemeId("", "  "), null);
});

test("result, gallery, preview, and export all frame from the same resolver", () => {
  // The result view no longer frames from the draft alone.
  assert.match(entry, /themeId=\{resolvePolaroidFrameThemeId\(generationResult\?\.themeId, answers\.themeId\) \?\? ""\}/);
  assert.doesNotMatch(entry, /<PolaroidGenerationExperience[\s\S]{0,400}themeId=\{answers\.themeId\}/);

  // The gallery frames from the saved row.
  assert.match(gallery, /themeId=\{item\.themeId\}/);

  // The live preview still frames from the choice being made, which is correct
  // while there is no saved result yet.
  assert.match(entry, /<SeasonalPolaroidFrame[\s\S]{0,300}themeId=\{answers\.themeId\}/);

  // One component resolves the layout for every surface, and the export
  // rasterises that same node rather than picking a frame of its own.
  assert.equal((frame.match(/polaroidFrameLayout\(/g) ?? []).length, 1);
  assert.match(frame, /const layout = polaroidFrameLayout\(themeId\)/);
  assert.match(entry, /polaroidRef=\{polaroidRef\}/);
  const exportLib = readFileSync("lib/seasonal-polaroid-export.ts", "utf8");
  assert.doesNotMatch(exportLib, /polaroidFrameLayout|templateSrc|themeId/);
});

test("the saved themeId travels from the worker through the status API to the result", () => {
  const worker = readFileSync("app/api/internal/ai-worker/route.ts", "utf8");
  const status = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
  const myPolaroids = readFileSync("app/api/my-polaroids/route.ts", "utf8");
  // Stored from the validated answers, returned with the result, and read back
  // from the saved row by the gallery.
  assert.match(worker, /themeId: validated\.answers\.themeId/);
  assert.match(status, /themeId: result\.themeId \?\? null/);
  assert.match(myPolaroids, /themeId: row\.theme_id/);
});
