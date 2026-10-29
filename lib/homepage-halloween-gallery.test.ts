import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gallery = readFileSync("components/homepage/pet-gallery.tsx", "utf8");
const css = readFileSync("components/homepage/homepage.module.css", "utf8");
const rule = (selector: string, block?: string) => {
  const pattern = new RegExp(`${selector.replace(/[.\\]/g, "\\$&")} \\{([^}]*)\\}`, "g");
  const matches = [...css.matchAll(pattern)].map((match) => match[1]!);
  assert.ok(matches.length, `${selector} rule missing`);
  return block === undefined ? matches[0]! : matches.find((text) => text.includes(block)) ?? "";
};
const mediaBlock = (query: string) => {
  const start = css.indexOf(`@media (${query})`);
  assert.ok(start >= 0, `media query ${query} missing`);
  return css.slice(start, css.indexOf("\n}\n", start));
};

test("the homepage Halloween Polaroids are four cards, one image each, in one desktop row and a 2 × 2 grid below", () => {
  assert.equal((gallery.match(/image: "\/images\/halloween\/card-\d-[a-z-]+\.png"/g) ?? []).length, 4);
  assert.equal((gallery.match(/<Image\b/g) ?? []).length, 3, "four cards share one <Image> plus the two decor layers");
  // The card is 44vw in the 2 × 2 grid on phones too; asking for 90vw downloaded a variant more than twice as large as needed.
  assert.match(gallery, /sizes="\(max-width: 1023px\) 44vw, 230px"/);
  assert.match(rule(".halloweenGrid"), /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  const tablet = mediaBlock("max-width: 63.999rem");
  assert.match(tablet, /\.halloweenGrid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)[^}]*grid-auto-rows: 1fr/);
  const phone = mediaBlock("max-width: 39.999rem");
  assert.match(phone, /\.halloweenGrid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(phone, /\.halloweenDecor \{ display: none; \}/);
});

test("each pet photo is a single cover-fit layer clipped to its own card, without side bleed", () => {
  const photo = rule(".halloweenPhoto");
  assert.match(photo, /overflow: hidden/);
  assert.match(photo, /aspect-ratio: 1\.15/);
  const image = rule(".halloweenPhotoImage");
  assert.match(image, /object-fit: cover/);
  assert.match(image, /object-position: center/);
  assert.match(image, /width: 100% !important; height: 100% !important/);
  assert.match(rule(".halloweenCard"), /overflow: hidden/);
  assert.doesNotMatch(css, /\.halloweenPhoto[^{]*\{[^}]*background-image/);
});

test("the opaque decor crops fade on their inner and top edges so no panel seam shows beside the cards", () => {
  assert.match(rule(".halloweenDecor"), /mask-composite: intersect/);
  for (const side of ["Left", "Right"]) {
    const block = rule(`.halloweenDecor${side}`);
    assert.match(block, side === "Left" ? /linear-gradient\(to right, #000 calc\(100% - 7rem\), transparent\)/ : /linear-gradient\(to left, #000 calc\(100% - 7rem\), transparent\)/);
    assert.match(block, /linear-gradient\(to bottom, transparent, #000 9rem\)/);
    assert.match(block, /-webkit-mask-image/);
  }
});
