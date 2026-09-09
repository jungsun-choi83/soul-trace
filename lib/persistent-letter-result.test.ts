import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync("app/letter-result/page.tsx", "utf8");
const loader = readFileSync("lib/persistent-letter-result.ts", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const archive = readFileSync("components/life-archive-preview.tsx", "utf8");
const generation = readFileSync("app/api/generate-letter/route.ts", "utf8");
const migration = readFileSync(
  "supabase/migration_add_persistent_letter_result.sql",
  "utf8",
);

describe("Life Archive Phase 5 persistent letter return", () => {
  it("uses a stable server-loaded result route without an ID in the URL", () => {
    assert.match(page, /loadPersistentLetterResult/);
    assert.match(archive, /window\.location\.assign\("\/letter-result"\)/);
    assert.doesNotMatch(archive, /letter-result\?/);
  });

  it("requires both session owner and the HTTP-only selected submission", () => {
    assert.match(loader, /auth\.getUser\(\)/);
    assert.match(loader, /ACTIVE_SUBMISSION_COOKIE/);
    assert.match(loader, /\.eq\("submission_id", submissionId\)/);
    assert.match(loader, /\.eq\("owner_user_id", userData\.user\.id\)/);
  });

  it("reuses the existing result component", () => {
    assert.match(page, /<SoulTraceFlow mode=\{saved\.mode\} initialResult=\{saved\.result\}/);
    assert.match(flow, /initialResult\?: GeneratedResult/);
  });

  it("stores explicit presentation fields for new letters", () => {
    for (const field of ["letter_title", "letter_ending_phrase", "letter_mode"]) {
      assert.match(migration, new RegExp(`\\b${field}\\b`));
      assert.match(generation, new RegExp(`${field}:`));
    }
  });

  it("never regenerates a restored letter when interface language changes", () => {
    assert.match(flow, /if \(isRestoredResult\) return/);
    assert.match(loader, /generation_locale/);
    assert.match(loader, /letterStructure/);
    assert.doesNotMatch(loader, /translate/i);
  });

  it("signs a stored private hero image again when reopening", () => {
    assert.match(loader, /hero_image_ref/);
    assert.match(loader, /createSignedUrl/);
  });
});
