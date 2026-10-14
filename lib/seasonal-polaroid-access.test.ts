import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const access = readFileSync("lib/seasonal-polaroid-access.ts", "utf8");
const route = readFileSync("app/api/seasonal-polaroid/route.ts", "utf8");
const status = readFileSync("app/api/ai-generation/status/route.ts", "utf8");
const image = readFileSync("app/api/seasonal-polaroid/image/route.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");

test("controlled access is optional, but fails closed when test mode is enabled", () => {
  assert.match(access, /SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE/);
  assert.match(access, /SOUL_TRACE_SEASONAL_POLAROID_TEST_TOKEN/);
  assert.match(access, /SOUL_TRACE_SEASONAL_POLAROID_TEST_USER_IDS/);
  assert.match(access, /SOUL_TRACE_SEASONAL_POLAROID_TEST_EMAILS/);
  assert.match(access, /timingSafeEqual/);
  assert.match(access, /createSupabaseAuthServerClient/);
  assert.match(access, /if \(!enabled\(process\.env\.SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE\)\) return true/);
  assert.match(access, /return false/);
});

test("developer bypass is server-only, development-only, and loopback-only", () => {
  assert.match(access, /process\.env\.NODE_ENV === "development"/);
  assert.match(access, /SOUL_TRACE_SEASONAL_POLAROID_TEST_MODE/);
  assert.match(access, /seasonalPolaroidDeveloperRequestAllowed/);
  assert.match(access, /LOCAL_DEVELOPMENT_HOSTNAMES/);
  assert.doesNotMatch(access, /DEV_MAX_GENERATIONS|developerAdmissions|Developer test budget/);
  assert.match(packageJson, /"dev":\s*"next dev --hostname 127\.0\.0\.1"/);
});

test("unauthorized Seasonal POST requests are rejected before form parsing or admission", () => {
  assert.match(route, /seasonalPolaroidAccessAllowed\(request\)/);
  assert.match(route, /seasonalPolaroidAccessAllowed\(request\)[\s\S]{0,1400}let formData/);
  assert.match(route, /status: 404/);
});

test("status and private image delivery use the same controlled access gate", () => {
  assert.match(status, /seasonalPolaroidAccessAllowed\(request\)/);
  assert.match(image, /seasonalPolaroidAccessAllowed\(request\)/);
  assert.match(status, /x-soul-trace-seasonal-capability/);
  assert.doesNotMatch(status, /searchParams\.get\("capability"\)/);
  assert.match(status, /Cache-Control.*private, no-store/);
});
