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
  assert.match(frame, /<img data-seasonal-polaroid="template" src=\{layout\.templateSrc\}/);
  assert.match(frame, /left: layout\.photo\.left,[\s\S]*?top: layout\.photo\.top,[\s\S]*?width: layout\.photo\.width,[\s\S]*?height: layout\.photo\.height,[\s\S]*?borderRadius: layout\.photoRadius/);
  assert.match(frame, /<img data-seasonal-polaroid="photo" src=\{imageUrl\}[^>]*className="h-full w-full object-cover object-center"/);
  assert.match(frame, /left: layout\.caption\.left,[\s\S]*?right: layout\.caption\.right,[\s\S]*?top: layout\.caption\.top,[\s\S]*?bottom: layout\.caption\.bottom/);
  assert.match(frame, /font-semibold leading-\[1\.1\] text-\[#49372A\]/);
});

test("native layers export in frame-specific order, which keeps Gouache flowers above the photo", () => {
  // Those two images are excluded from the SVG capture...
  assert.match(exporter, /filter: \(element: HTMLElement\) => \{[\s\S]*?return name !== "template" && name !== "photo";/);
  // ...and drawn from decoded <img> elements. Legacy templates remain under
  // the photo; Gouache's transparent floral overlay is drawn after it.
  assert.match(exporter, /const templateOverlay = node\.getAttribute\("data-seasonal-polaroid-template-overlay"\) === "true";/);
  assert.match(exporter, /stage\.fillStyle = templateOverlay \? "#000000" : SEASONAL_POLAROID_EXPORT_BACKGROUND;/);
  assert.match(exporter, /if \(templateOverlay\) \{\s*drawPhoto\(\);\s*drawTemplate\(\);\s*\} else \{\s*drawTemplate\(\);\s*drawPhoto\(\);\s*\}/);
  assert.match(exporter, /if \(template && template\.naturalWidth\) drawFitted\(stage, template, layoutRect\(template\)\);/);
  assert.match(exporter, /if \(photo && photo\.naturalWidth\) drawFitted\(stage, photo, windowRect\);/);
  const vectorDraw = exporter.indexOf("stage.drawImage(vectorLayer, 0, 0);");
  assert.ok(vectorDraw > exporter.indexOf("if (templateOverlay)"), "the vector layer must remain above the bitmap layers");
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
