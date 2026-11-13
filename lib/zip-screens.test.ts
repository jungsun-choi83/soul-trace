import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const welcome = readFileSync("components/welcome-experience.tsx", "utf8");
const auth = readFileSync("components/auth-entry.tsx", "utf8");
const form = readFileSync("components/pet-form-shell.tsx", "utf8");
const dashboard = readFileSync("components/customer-dashboard.tsx", "utf8");
const memory = readFileSync("components/pet-first-memory.tsx", "utf8");
const roster = readFileSync("components/pet-roster.tsx", "utf8");
const settings = readFileSync("components/account-settings.tsx", "utf8");
const tabs = readFileSync("lib/story-tabs.ts", "utf8");
const createHub = readFileSync("components/create-hub.tsx", "utf8");
const choose = readFileSync("components/mode-choice.tsx", "utf8");
const living = readFileSync("app/living/page.tsx", "utf8");
const memorial = readFileSync("app/memorial/page.tsx", "utf8");
const polaroid = readFileSync("components/polaroid-entry.tsx", "utf8");
const collar = readFileSync("components/collar-studio.tsx", "utf8");

test("implemented ZIP screens stay on distinct consumer routes", () => {
  assert.match(welcome, /WelcomeExperience|welcomeRegister|welcomeStartCta/);
  assert.match(auth, /createPasswordAccount/);
  assert.match(form, /helloLittle|setupTitle/);
  assert.match(dashboard, /CustomerDashboard|walkTitle/);
  assert.match(memory, /memoryTabRecord/);
  assert.match(roster, /profileSpace/);
  assert.match(roster, /StoryBrandHeader/);
  assert.match(settings, /settingsNotifyMemorial/);
  assert.match(settings, /StoryBrandHeader/);
  assert.match(memory, /StoryBrandHeader/);
  assert.match(choose, /StoryBrandHeader/);
  assert.match(collar, /StoryBrandHeader/);
  assert.match(choose, /letterLivingCta|letterMemorialCta|ModeChoice/);
  assert.match(living, /SoulTraceFlow|living/);
  assert.match(memorial, /SoulTraceFlow|memorial/);
  assert.match(polaroid, /data-polaroid-flow/);
  assert.match(collar, /collar/);
});

test("추억 and 내 아이 are no longer the same screen", () => {
  assert.match(tabs, /pet: "\/my\/pets"/);
  assert.match(tabs, /memoriesMonthHref\(petId\)/);
  assert.match(tabs, /createQuery\.set\("branch", status\)/);
  assert.match(tabs, /\/create\?\$\{createQuery/);
  assert.match(memory, /current="memories"/);
  assert.match(roster, /current="pet"/);
  assert.match(createHub, /current="create"/);
  assert.doesNotMatch(roster, /memoryTabRecord/);
  assert.doesNotMatch(memory, /profileSpace/);
});

test("P2 ZIP screens stay planned cards without checkout or grief alerts", () => {
  assert.match(dashboard, /copy\.soon/);
  assert.match(memory, /copy\.plannedFamily/);
  assert.match(settings, /copy\.off/);
  assert.doesNotMatch(`${dashboard}${memory}${settings}${roster}`, /href=["']\/(?:walk|family|premium)/);
  assert.doesNotMatch(`${settings}${dashboard}`, /checkout|tosspayments|결제하기/);
});
