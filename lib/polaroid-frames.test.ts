import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  CRAYON_POLAROID_FRAME_SRC,
  FELT_POLAROID_FRAME_SRC,
  GOUACHE_POLAROID_FRAME_SRC,
  HALLOWEEN_POLAROID_FRAME_SRC,
  polaroidFrameLayout,
} from "./polaroid-frames.ts";

test("each everyday art style has its own frame file and a different hole than Halloween", () => {
  assert.ok(existsSync("public/images/soul_trace_seasonal_polaroid_blank_caption_template.png"));
  assert.ok(existsSync("public/images/polaroid/frame-felt.jpg"));
  assert.ok(existsSync("public/images/polaroid/frame-gouache.jpg"));
  assert.ok(existsSync("public/images/polaroid/frame-crayon.jpg"));
  assert.equal(polaroidFrameLayout("halloween").templateSrc, HALLOWEEN_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("felt-doll").templateSrc, FELT_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("gouache-story").templateSrc, GOUACHE_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("crayon-diary").templateSrc, CRAYON_POLAROID_FRAME_SRC);
  assert.equal(polaroidFrameLayout("felt-doll").halloweenDecor, false);
  assert.equal(polaroidFrameLayout("halloween").flowers, true);
  assert.notEqual(polaroidFrameLayout("felt-doll").photo.left, polaroidFrameLayout("halloween").photo.left);
});
