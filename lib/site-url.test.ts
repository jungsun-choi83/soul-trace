import assert from "node:assert/strict";
import test from "node:test";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./site-url.ts";

test("canonical site URL is a single-line origin", () => {
  assert.equal(SITE_URL.endsWith("/"), false);
  assert.doesNotMatch(SITE_URL, /\s/);
  assert.match(SITE_URL, /^https:\/\/[^/]+$/);
});

test("public SEO copy is present and does not claim checkout", () => {
  assert.match(SITE_TITLE, /소울트레이스/);
  assert.match(SITE_DESCRIPTION, /편지/);
  assert.doesNotMatch(SITE_DESCRIPTION, /결제|구매|장바구니/);
});
