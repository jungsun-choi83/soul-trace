import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getMemoryShopLetterSetUrl, getMemoryShopUrl } from "./memory-shop-url.ts";

test("memory shop URL is the same-origin Memory Shop, not GitHub Pages", () => {
  assert.equal(getMemoryShopUrl(), "/shop/");
  assert.doesNotMatch(getMemoryShopUrl(), /github\.io/);
  assert.doesNotMatch(getMemoryShopLetterSetUrl(), /github\.io/);
});

test("letter-set CTA lands on the letter product in the memory shop", () => {
  assert.equal(getMemoryShopLetterSetUrl(), "/shop/?product=letter");
});

test("living result card opens the hosted Memory Shop letter set", () => {
  const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(flow, /href=\{memoryShopLetterSetUrl\}/);
  assert.doesNotMatch(flow, /memoryShopLetterSetUrl[\s\S]{0,500}disabled/);
  assert.match(config, /source: "\/shop"/);
  assert.match(config, /destination: "\/shop\/"/);
  assert.doesNotMatch(config, /github\.io/);
  assert.equal(existsSync("public/shop/index.html"), true);
  assert.equal(existsSync("public/shop/src/app.mjs"), true);
  assert.match(readFileSync("public/shop/index.html", "utf8"), /src="\/shop\/src\/app\.mjs"/);
  assert.match(readFileSync("public/shop/src/app.mjs", "utf8"), /catalogProductIdFromQuery/);
});
