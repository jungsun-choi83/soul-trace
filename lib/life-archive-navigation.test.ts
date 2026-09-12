import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLifeArchiveNavigation,
  safeLetterReturnPath,
} from "./life-archive-navigation.ts";

test("letter origin returns to an explicitly allowed result route", () => {
  const navigation = resolveLifeArchiveNavigation({
    from: "letter",
    returnTo: "/living?p=partner&ch=pension",
  });
  assert.equal(navigation.origin, "letter");
  assert.equal(navigation.backHref, "/living?p=partner&ch=pension");
  assert.match(navigation.archiveQuery, /from=letter/);
  assert.match(navigation.archiveQuery, /returnTo=%2Fliving%3Fp%3Dpartner%26ch%3Dpension/);
});

test("choose origin and direct visits return safely to choose with context", () => {
  assert.deepEqual(resolveLifeArchiveNavigation({ from: "choose" }), {
    origin: "choose",
    backHref: "/choose",
    archiveQuery: "from=choose",
  });
  const direct = resolveLifeArchiveNavigation({ p: "partner", ch: "grooming", pet: "selected", letter: "selected" });
  assert.equal(direct.origin, "choose");
  assert.equal(direct.backHref, "/choose?p=partner&ch=grooming");
  assert.equal(direct.archiveQuery, "p=partner&ch=grooming");
});

test("invalid and external letter destinations cannot escape to another route", () => {
  assert.equal(safeLetterReturnPath("https://evil.example/result"), "/letter-result");
  assert.equal(safeLetterReturnPath("//evil.example/result"), "/letter-result");
  assert.equal(safeLetterReturnPath("/auth"), "/letter-result");
  assert.equal(safeLetterReturnPath(null), "/letter-result");
});
