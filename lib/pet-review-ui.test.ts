import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("pet review updates the existing profile and links letters through their separate archive", () => {
  const roster = read("components/pet-review-roster.tsx");
  assert.match(roster, /\/my\/pets\/\$\{encodeURIComponent\(pet\.petId\)\}\/edit\?focus=status/);
  assert.match(roster, /Pet ID, letters, and memories stay linked/);
  assert.match(roster, /\/life-archive\?pet=/);
  assert.doesNotMatch(roster, /#letters/);

  const page = read("app/my/pets/review/page.tsx");
  assert.doesNotMatch(page, /claim_soul_trace_legacy_records/);
  assert.match(page, /loadPetRosterForUser/);
});

test("pet roster exposes review and does not treat unspecified pets as active Living or Memorial pets", () => {
  const roster = read("components/pet-roster.tsx");
  assert.match(roster, /splitCurrentAndUnclassifiedPets\(pets\)/);
  assert.match(roster, /current\[0\] \?\? null/);
  assert.match(roster, /href="\/my\/pets\/review"/);
  assert.match(roster, /unclassified\.length > 0/);
});

test("Memory Archive timeline remains photo, video, and text media; saved Polaroids stay separate", () => {
  const memories = read("app/api/my/pets/[petId]/memories/route.ts");
  const library = read("lib/memory-library.ts");
  assert.match(library, /MemoryKind = "photo" \| "video" \| "text"/);
  assert.match(memories, /return privateJson\(\{ timeline, letters, polaroids \}, 200\)/);
  assert.doesNotMatch(memories, /origin: "polaroid" as const/);
});

test("normal Welcome and Free Trial remain distinct from the Living and Memorial journey", () => {
  const welcome = read("app/page.tsx");
  const trial = read("components/free-trial-start.tsx");
  const choice = read("app/choose/page.tsx");
  assert.match(welcome, /<HomeEntry>[\s\S]*<FreeTrialStart\s*\/>/);
  assert.match(trial, /href="\/try"/);
  assert.match(trial, /href="\/choose"/);
  assert.match(trial, /absolute inset-0 h-full w-full object-cover/);
  assert.doesNotMatch(trial, /aspect-\[3\/4\]|rounded-\[22px\]/);
  assert.match(choice, /<EntryChoice petId=\{petId\} \/>/);
});
