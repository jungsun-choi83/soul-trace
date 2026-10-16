import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveLetterLanguage } from "./letter-language.ts";

const resultView = readFileSync("components/soul-trace-flow.tsx", "utf8");
const archiveView = readFileSync("components/life-archive-preview.tsx", "utf8");
const persistentLoader = readFileSync("lib/persistent-letter-result.ts", "utf8");
const archivePage = readFileSync("app/life-archive/page.tsx", "utf8");
const temporaryArchive = readFileSync("lib/life-archive-temporary.ts", "utf8");

test("English and Korean generated letters retain their own language across UI changes", () => {
  assert.equal(resolveLetterLanguage("en", "ko"), "en");
  assert.equal(resolveLetterLanguage("ko", "en"), "ko");
  assert.match(resultView, /const letterLanguage = resolveLetterLanguage\(result\?\.generationLocale, resultLocale\)/);
  assert.doesNotMatch(resultView, /fontFamily: lang === "ko"/);
});

test("older session results use persisted resultLocale, never the current UI locale", () => {
  assert.equal(resolveLetterLanguage(undefined, "en"), "en");
  assert.equal(resolveLetterLanguage(undefined, "ko"), "ko");
  assert.equal(resolveLetterLanguage(undefined, undefined), "en");
  assert.match(temporaryArchive, /generationLocale: resolveLetterLanguage\(value\.generationLocale\)/);
});

test("saved English and Korean letters recover persisted generation language", () => {
  assert.match(persistentLoader, /resolveLetterLanguage\(submission\.generation_locale\)/);
  assert.match(persistentLoader, /generationLocale,/);
  assert.doesNotMatch(persistentLoader, /useLocale|\blang\b/);
});

test("Life Archive typography follows each letter's generation locale", () => {
  assert.match(archivePage, /generationLocale: resolveLetterLanguage\(submission\.generation_locale\)/);
  assert.match(archiveView, /archive\.generationLocale === "ko"/);
  assert.match(archiveView, /--font-letter-ko/);
  assert.match(archiveView, /--font-letter-en-body/);
  assert.doesNotMatch(archiveView, /fontFamily: lang === "ko"/);
});

test("language switching does not translate or regenerate restored letters", () => {
  assert.match(resultView, /if \(isRestoredResult\) return/);
  assert.doesNotMatch(archiveView, /t\([^\n]*archive\.letter/);
});
