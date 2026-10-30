import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const guard = readFileSync("lib/ai-generation-guard.ts", "utf8");
const client = readFileSync("lib/seasonal-polaroid-client.ts", "utf8");
const component = readFileSync("components/polaroid-entry.tsx", "utf8");
const migration = readFileSync("supabase/migration_ai_generation_rate_limit_retry_after.sql", "utf8");
const en = readFileSync("locales/en.json", "utf8");
const ko = readFileSync("locales/ko.json", "utf8");

test("rate-limited and busy admissions expose distinct machine-readable codes", () => {
  assert.match(guard, /decision\.decision === "rate_limited"/);
  assert.match(guard, /code: "rate_limited"/);
  assert.match(guard, /decision\.decision === "busy"/);
  assert.match(guard, /code: "busy"/);
  assert.match(guard, /status: 429/);
});

test("the retry migration calculates short and daily rolling waits", () => {
  assert.match(migration, /offset \(recent_count - p_ip_limit\)/);
  assert.match(migration, /offset \(recent_count - p_ip_daily_limit\)/);
  assert.match(migration, /p_window_seconds/);
  assert.match(migration, /p_daily_window_seconds/);
  assert.match(migration, /short_retry_after integer := 0/);
  assert.match(migration, /daily_retry_after integer := 0/);
  assert.match(migration, /greatest\(short_retry_after, daily_retry_after\)/);
  assert.match(migration, /decision', 'rate_limited'/);
});

test("missing retry data is handled without exposing identifiers", () => {
  assert.match(client, /response\.headers\.get\("Retry-After"\)/);
  assert.match(client, /retryAfter: number \| null/);
  assert.doesNotMatch(guard, /error:\s*[^,}]*ipHash/);
  assert.doesNotMatch(guard, /error:\s*[^,}]*identityHash/);
});

test("Seasonal questionnaire state and photos remain after a rejected admission", () => {
  assert.match(component, /setView\("questionnaire"\);[\s\S]{0,260}setGenerationError\(sessionExpired \? null : message\)/);
  // The only place the photo is cleared is the explicit Remove button.
  assert.equal(component.match(/setPrimaryPhoto\(null\)/g)?.length, 1);
  assert.match(component, /const removePhoto = \(\) => \{\s*if \(primaryPhoto\) URL\.revokeObjectURL\(primaryPhoto\.url\);\s*setPrimaryPhoto\(null\);/);
  assert.doesNotMatch(component, /secondPhoto|secondInputRef|secondLabel/);
});

test("expired Seasonal sessions reopen OTP instead of reusing a stale verification flag", () => {
  assert.match(component, /requestError\.status === 401/);
  assert.match(component, /await authSession\.refresh\(\)/);
  assert.match(component, /setEmailStep\("email"\)/);
  assert.match(component, /setEmailModalOpen\(true\)/);
});

test("rate-limit messages exist in English and Korean", () => {
  for (const locale of [en, ko]) {
    assert.match(locale, /"rateLimited":/);
    assert.match(locale, /"busy":/);
    assert.match(locale, /"tryLater":/);
    assert.match(locale, /%TIME%/);
  }
});

test("capacity remains queued instead of rejected by the Seasonal migration", () => {
  assert.match(migration, /next_status := case when active_count < p_global_limit and queued_count = 0 then 'processing' else 'queued' end/);
  assert.doesNotMatch(migration, /active_count >= p_global_limit[\s\S]{0,120}decision', 'busy'/);
});
