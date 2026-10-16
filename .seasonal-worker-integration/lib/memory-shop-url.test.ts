import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getMemoryShopLetterSetUrl, getMemoryShopUrl } from "./memory-shop-url.ts";

test("memory shop URL is soultrace.pet/shop, not GitHub Pages", () => {
  assert.equal(getMemoryShopUrl(), "https://soultrace.pet/shop");
  assert.equal(getMemoryShopLetterSetUrl(), "https://soultrace.pet/shop");
  assert.doesNotMatch(getMemoryShopUrl(), /github\.io/);
  assert.doesNotMatch(getMemoryShopLetterSetUrl(), /[?&]product=/);
});

test("living result card opens https://soultrace.pet/shop", () => {
  const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
  const header = readFileSync("components/homepage/homepage-header.tsx", "utf8");
  assert.match(flow, /href=\{memoryShopLetterSetUrl\}/);
  assert.doesNotMatch(flow, /memoryShopLetterSetUrl[\s\S]{0,500}disabled/);
  assert.match(header, /SHOP_URL = getMemoryShopUrl\(\)/);
  assert.equal(existsSync("public/shop/index.html"), true);
  assert.equal(existsSync("public/shop/src/app.mjs"), true);
});
