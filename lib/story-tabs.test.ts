import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { petFirstCopy } from "./storybook-copy.ts";
import { storyTabHrefs, storyTabLabels } from "./story-tabs.ts";

const tabbar = readFileSync("components/storybook/story-tabbar.tsx", "utf8");
const createPage = readFileSync("app/create/page.tsx", "utf8");
const createHub = readFileSync("components/create-hub.tsx", "utf8");
const living = readFileSync("app/living/page.tsx", "utf8");
const memorial = readFileSync("app/memorial/page.tsx", "utf8");
const polaroid = readFileSync("app/polaroid/page.tsx", "utf8");
const memorialSpace = readFileSync("app/memorial-space/page.tsx", "utf8");
const petMemory = readFileSync("components/pet-first-memory.tsx", "utf8");
const petRoster = readFileSync("components/pet-roster.tsx", "utf8");

test("four tabs stay home, memories, create, and pet", () => {
  const livingTabs = storyTabHrefs("pet-1", true, "living");
  const memorialTabs = storyTabHrefs("pet-1", true, "memorial");
  const openTabs = storyTabHrefs(null, true, "unspecified");
  const labels = storyTabLabels(petFirstCopy("ko"), "living");

  assert.deepEqual(Object.keys(livingTabs), ["home", "memories", "create", "pet"]);
  assert.equal(livingTabs.home, "/dashboard/living?pet=pet-1");
  assert.equal(livingTabs.memories, "/my/pets/pet-1/memories#album");
  assert.equal(livingTabs.create, "/create?pet=pet-1&branch=living");
  assert.equal(livingTabs.pet, "/my/pets");
  assert.equal(memorialTabs.home, "/dashboard/memorial?pet=pet-1");
  assert.equal(memorialTabs.memories, "/my/pets/pet-1/memories#album");
  assert.equal(memorialTabs.create, "/create?pet=pet-1&branch=memorial");
  assert.equal(storyTabHrefs("pet-2", true, "living").memories, "/my/pets/pet-2/memories#album");
  assert.equal(openTabs.memories, "/my/pets");
  assert.equal(storyTabHrefs(null, false, "unspecified").memories, "/memories");
  assert.equal(storyTabHrefs("pet-1", false, "living").memories, "/memories?pet=pet-1");
  assert.match(petRoster, /href="\/my\/pets\/new"/);
  assert.match(petMemory, /<StoryTabbar current="memories"/);
  assert.match(petMemory, /<section id="album"/);
  assert.doesNotMatch(readFileSync("app/memories/page.tsx", "utf8"), /LifeArchiveAccessRequired|eternal-beam-access/);
  assert.match(readFileSync("app/life-archive/page.tsx", "utf8"), /LifeArchiveAccessRequired/);
  assert.match(readFileSync("components/memories-archive.tsx", "utf8"), /아직 기록한 추억이 없어요/);
  assert.equal(labels.home, "홈");
  assert.equal(labels.pet, "내 아이");
  assert.equal(Object.keys(labels).includes("context"), false);
  assert.doesNotMatch(JSON.stringify(livingTabs), /beam-scene|eternal-beam|memorial-space|\/my\/device/);
  assert.match(tabbar, /"home", "memories", "create", "pet"/);
  assert.match(tabbar, /grid-cols-4/);
  assert.doesNotMatch(tabbar, /"context"|grid-cols-5/);
  assert.doesNotMatch(tabbar, /"letter"|"polaroid"/);
});

test("create hub reuses letter and polaroid engines instead of replacing them", () => {
  assert.match(createPage, /CreateHub/);
  assert.match(createHub, /letterPathForLifeStatus/);
  assert.match(createHub, /polaroidHrefFromArchive|\/polaroid/);
  assert.match(createHub, /current="create"/);
  assert.match(living, /SoulTraceFlow mode="living"/);
  assert.match(memorial, /SoulTraceFlow mode="memorial"/);
  assert.match(polaroid, /PolaroidEntry/);
  assert.match(memorialSpace, /MemorialSpace/);
  assert.doesNotMatch(createHub, /checkout|tosspayments|결제하기/);
});
