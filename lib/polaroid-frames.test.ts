import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  CRAYON_POLAROID_FRAME_SRC,
  CRAYON_POLAROID_FRAME_ART_SRC,
  FELT_POLAROID_FRAME_ART_SRC,
  FELT_POLAROID_FRAME_SRC,
  GOUACHE_POLAROID_FRAME_ART_SRC,
  GOUACHE_POLAROID_FRAME_SRC,
  HALLOWEEN_POLAROID_FRAME_SRC,
  polaroidFrameLayout,
} from "./polaroid-frames.ts";

function luminance(hex: string): number {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

test("each everyday art style has its own frame file and a different hole than Halloween", () => {
  assert.ok(existsSync("public/images/soul_trace_seasonal_polaroid_blank_caption_template.png"));
  assert.ok(existsSync("public/images/polaroid/frame-felt.jpg"));
  assert.ok(existsSync("public/images/polaroid/frame-felt-overlay.png"));
  assert.ok(existsSync("public/images/polaroid/black inner floral storybook card.png"));
  assert.ok(existsSync("public/images/polaroid/black inner floral storybook card-overlay.png"));
  assert.ok(existsSync("public/images/polaroid/frame-crayon.jpg"));
  assert.ok(existsSync("public/images/polaroid/frame-crayon-overlay.png"));
  assert.equal(CRAYON_POLAROID_FRAME_ART_SRC, "/images/polaroid/frame-crayon.jpg");
  assert.equal(polaroidFrameLayout("halloween").templateSrc, HALLOWEEN_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("felt-doll").templateSrc, FELT_POLAROID_FRAME_SRC);
  assert.equal(FELT_POLAROID_FRAME_ART_SRC, "/images/polaroid/frame-felt.jpg");
  assert.equal(polaroidFrameLayout("gouache-story").templateSrc, GOUACHE_POLAROID_FRAME_SRC);
  assert.equal(GOUACHE_POLAROID_FRAME_ART_SRC, "/images/polaroid/black inner floral storybook card.png");
  assert.equal(polaroidFrameLayout("gouache-story").templateSrc, "/images/polaroid/black inner floral storybook card-overlay.png");
  assert.equal(polaroidFrameLayout("gouache-story").templateObjectFit, "contain");
  assert.equal(polaroidFrameLayout("crayon-diary").templateSrc, CRAYON_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("crayon-diary").templateOverlay, true);
  assert.equal(polaroidFrameLayout("felt-doll").halloweenDecor, false);
  assert.equal(polaroidFrameLayout("felt-doll").templateOverlay, true);
  assert.equal(polaroidFrameLayout("halloween").flowers, true);
  assert.notEqual(polaroidFrameLayout("felt-doll").photo.left, polaroidFrameLayout("halloween").photo.left);
});

test("every frame keeps its photo window clear of the caption band", () => {
  for (const theme of ["halloween", "felt-doll", "gouache-story", "crayon-diary"]) {
    const layout = polaroidFrameLayout(theme);
    const photoBottom = Number.parseFloat(layout.photo.top) + Number.parseFloat(layout.photo.height);
    const captionTop = Number.parseFloat(layout.caption.top);
    assert.ok(captionTop - photoBottom >= 1, `${theme}: photo and caption need a visible safety gap`);
  }

  const crayon = polaroidFrameLayout("crayon-diary");
  assert.ok(Math.abs(Number.parseFloat(crayon.photo.top) + Number.parseFloat(crayon.photo.height) - 66.5) < 0.001);
  assert.equal(Number.parseFloat(crayon.photo.left), 9.5);
  assert.equal(Number.parseFloat(crayon.photo.width), 81);
  assert.equal(Number.parseFloat(crayon.caption.top), 70);
  const gouache = polaroidFrameLayout("gouache-story");
  assert.ok(Math.abs(Number.parseFloat(gouache.photo.top) + Number.parseFloat(gouache.photo.height) - 67.2) < 0.001);
  assert.equal(Number.parseFloat(gouache.caption.top), 68.2);
  assert.equal(gouache.captionSurface, undefined, "the supplied card has a cream caption area");
  assert.equal(gouache.templateOverlay, true, "Gouache flowers should sit above the photo in the opening");
  assert.equal(Number.parseFloat(gouache.photo.left), 13.4);
  assert.equal(Number.parseFloat(gouache.photo.width), 73.2);
});

test("Gouache actual and placeholder text have WCAG AA contrast on their surfaces", () => {
  const gouache = polaroidFrameLayout("gouache-story");
  assert.ok(gouache.captionTextColor);
  assert.ok(gouache.photoPlaceholderTextColor);
  assert.ok(contrastRatio(gouache.captionTextColor, "#F7EFD9") >= 4.5, "caption text should reach 4.5:1 on the supplied cream card");
  assert.ok(contrastRatio(gouache.photoPlaceholderTextColor, "#E9E1D7") >= 4.5, "photo placeholder text should reach 4.5:1");
});

test("Felt actual and placeholder text have WCAG AA contrast on the paper and photo surfaces", () => {
  const felt = polaroidFrameLayout("felt-doll");
  assert.ok(felt.captionTextColor);
  assert.ok(felt.photoPlaceholderTextColor);
  assert.ok(contrastRatio(felt.captionTextColor, "#F2E8D7") >= 4.5, "Felt caption text should reach 4.5:1 on the paper area");
  assert.ok(contrastRatio(felt.photoPlaceholderTextColor, "#E9E1D7") >= 4.5, "Felt photo placeholder text should reach 4.5:1");
});
