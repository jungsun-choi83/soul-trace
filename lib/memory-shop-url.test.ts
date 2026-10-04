import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getMemoryShopLetterSetUrl, getMemoryShopUrl } from "./memory-shop-url.ts";

test("memory shop URL is an absolute origin without a trailing slash", () => {
  assert.equal(getMemoryShopUrl().endsWith("/"), false);
  assert.match(getMemoryShopUrl(), /^https:\/\/[^/]+/);
});

test("letter-set CTA lands on the letter product in the memory shop", () => {
  const url = new URL(getMemoryShopLetterSetUrl());
  assert.equal(url.searchParams.get("product"), "letter");
  assert.equal(`${url.origin}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`, getMemoryShopUrl());
});

test("living result card and /shop redirect both use the memory shop letter set", () => {
  const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
  const config = readFileSync("next.config.ts", "utf8");
  assert.match(flow, /href=\{memoryShopLetterSetUrl\}/);
  assert.doesNotMatch(flow, /memoryShopLetterSetUrl[\s\S]{0,500}disabled/);
  assert.match(config, /source: "\/shop"/);
  assert.match(config, /destination: getMemoryShopLetterSetUrl\(\)/);
});
