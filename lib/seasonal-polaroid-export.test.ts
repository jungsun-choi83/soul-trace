import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SEASONAL_POLAROID_CAPTURE_STYLE,
  SEASONAL_POLAROID_PART_ATTRIBUTE,
  resolveSeasonalPolaroidRadius,
  seasonalPolaroidFittedBox,
} from "./seasonal-polaroid-export.ts";

const exporter = readFileSync("lib/seasonal-polaroid-export.ts", "utf8");
const frame = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");

test("the frame tags the parts the exporter draws natively, once each", () => {
  for (const name of ["template", "photo-window", "photo", "caption"]) {
    const matches = frame.match(new RegExp(`${SEASONAL_POLAROID_PART_ATTRIBUTE}="${name}"`, "g")) ?? [];
    assert.equal(matches.length, 1, `${name} must be tagged exactly once`);
  }
  // The tags sit on the elements the exporter expects.
  assert.match(frame, /<img data-seasonal-polaroid="template" src="\/images\/soul_trace_seasonal_polaroid_blank_caption_template\.png"/);
  assert.match(frame, /<div data-seasonal-polaroid="photo-window" className="absolute left-\[16\.2%\] top-\[15\.2%\][^"]*rounded-\[4%\] bg-\[#E9E1D7\]/);
  assert.match(frame, /<img data-seasonal-polaroid="photo" src=\{imageUrl\}[^>]*className="h-full w-full object-cover object-center"/);
  assert.match(frame, /<div data-seasonal-polaroid="caption" className="absolute bottom-\[19%\] left-\[19%\] right-\[19%\] top-\[70\.6%\]/);
});

test("the template and the photo bypass html-to-image, which WebKit paints before their data loads", () => {
  // Those two images are excluded from the SVG capture...
  assert.match(exporter, /filter: \(element: HTMLElement\) => \{[\s\S]*?return name !== "template" && name !== "photo";/);
  // ...and drawn from the decoded <img> elements with drawImage, template first, then the photo clipped to the window.
  const templateDraw = exporter.indexOf('if (template && template.naturalWidth) drawFitted(stage, template, layoutRect(template));');
  const photoDraw = exporter.indexOf('if (photo && photo.naturalWidth) drawFitted(stage, photo, windowRect);');
  const vectorDraw = exporter.indexOf("stage.drawImage(vectorLayer, 0, 0);");
  assert.ok(templateDraw > 0 && photoDraw > templateDraw && vectorDraw > photoDraw, "draw order must be template, photo, then the vector layer");
  assert.match(exporter, /roundedRectPath\(stage, windowRect, resolveSeasonalPolaroidRadius\(windowStyle\.borderTopLeftRadius/);
  assert.match(exporter, /stage\.clip\(\);/);
  // The vector layer is composited over them, so it must be captured transparent.
  assert.equal(SEASONAL_POLAROID_CAPTURE_STYLE.backgroundColor, "transparent");
  assert.doesNotMatch(exporter, /toCanvas\(node, \{[^}]*backgroundColor/);
  // The photo window's own background and inset shadow would cover the photo; they are hidden during the capture and restored.
  assert.match(exporter, /photoWindow\.style\.backgroundColor = "transparent";\s*photoWindow\.style\.boxShadow = "none";/);
  assert.match(exporter, /finally \{\s*if \(photoWindow && previous\) \{\s*photoWindow\.style\.backgroundColor = previous\.backgroundColor;\s*photoWindow\.style\.boxShadow = previous\.boxShadow;/);
  // Geometry is read from the rendered node, untransformed, not from constants.
  assert.match(exporter, /parseFloat\(style\.left\)/);
  assert.doesNotMatch(exporter, /0\.162|16\.2%|0\.678/);
});

test("a vector layer without caption ink is retried, then fails loudly instead of producing a blank file", () => {
  assert.match(exporter, /const VECTOR_LAYER_ATTEMPTS = 3;/);
  assert.match(exporter, /for \(let attempt = 1; attempt <= VECTOR_LAYER_ATTEMPTS; attempt\+\+\)/);
  assert.match(exporter, /hasCaptionInk\(layer, caption, pixelRatio\)\) return layer;/);
  assert.match(exporter, /throw new Error\("export_failed"\);\s*\} finally/);
  // Blob URLs for the generated image must not get a cache-busting query string.
  assert.match(exporter, /cacheBust: false/);
  // Every image is loaded and decoded before anything is drawn.
  assert.match(exporter, /await waitForSeasonalPolaroidAssets\(node\);/);
  assert.match(exporter, /image\.decode\(\)/);
});

test("percentage corner radii resolve against the box like CSS, capped at half the box", () => {
  assert.deepEqual(resolveSeasonalPolaroidRadius("4%", 300, 200), { x: 12, y: 8 });
  assert.deepEqual(resolveSeasonalPolaroidRadius("12px", 300, 200), { x: 12, y: 12 });
  assert.deepEqual(resolveSeasonalPolaroidRadius("10% 5%", 300, 200), { x: 30, y: 10 });
  assert.deepEqual(resolveSeasonalPolaroidRadius("60%", 300, 200), { x: 150, y: 100 });
  assert.deepEqual(resolveSeasonalPolaroidRadius("", 300, 200), { x: 0, y: 0 });
});

test("object-fit geometry matches the photo window: cover fills and centres, contain fits, fill stretches", () => {
  const box = { left: 10, top: 20, width: 300, height: 200 };
  const square = { width: 1024, height: 1024 };
  assert.deepEqual(seasonalPolaroidFittedBox("cover", square, box), { left: 10, top: -30, width: 300, height: 300 });
  assert.deepEqual(seasonalPolaroidFittedBox("contain", square, box), { left: 60, top: 20, width: 200, height: 200 });
  assert.deepEqual(seasonalPolaroidFittedBox("fill", square, box), box);
  // A landscape photo in a landscape window: cover crops the sides instead.
  const wide = { width: 2000, height: 1000 };
  assert.deepEqual(seasonalPolaroidFittedBox("cover", wide, box), { left: -40, top: 20, width: 400, height: 200 });
  assert.deepEqual(seasonalPolaroidFittedBox("cover", { width: 0, height: 0 }, box), box);
});
