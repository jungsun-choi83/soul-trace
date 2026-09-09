import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const storage = readFileSync("lib/life-archive-temporary.ts", "utf8");
const page = readFileSync("app/life-archive/page.tsx", "utf8");
const loader = readFileSync("components/temporary-life-archive-loader.tsx", "utf8");
const ui = readFileSync("components/life-archive-preview.tsx", "utf8");

describe("temporary Life Archive development fallback", () => {
  it("uses tab-scoped storage and never localStorage", () => {
    assert.match(storage, /window\.sessionStorage/);
    assert.doesNotMatch(storage, /localStorage/);
  });

  it("activates only when the authenticated Supabase client is unavailable", () => {
    assert.match(page, /if \(!supabase\) return <TemporaryLifeArchiveLoader/);
    assert.match(loader, /storageMode="temporary"/);
  });

  it("keeps the saved letter unchanged when interface language changes", () => {
    assert.match(storage, /letter: string/);
    assert.doesNotMatch(storage, /translat|replace.*letter/i);
    assert.match(ui, /archive\.generationLocale === "ko"/);
  });

  it("supports temporary memory creation and deletion in the current tab", () => {
    assert.match(ui, /storageMode === "temporary"/);
    assert.match(ui, /crypto\.randomUUID\(\)/);
    assert.match(ui, /memories\.filter/);
    assert.match(ui, /saveTemporaryLifeArchive/);
  });
});
