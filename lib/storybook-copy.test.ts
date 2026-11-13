import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  daysTogether,
  isSameDayLastYear,
  monthlyCardReady,
  seoulToday,
  timelineMonthKey,
} from "./pet-first-archive.ts";
import { fill, folderMemoryCount, petFirstCopy } from "./storybook-copy.ts";

test("korean and english storybook copy expose the same keys", () => {
  assert.deepEqual(Object.keys(petFirstCopy("en")).sort(), Object.keys(petFirstCopy("ko")).sort());
  assert.equal(petFirstCopy("en").adjustDates, "Adjust dates");
  assert.equal(petFirstCopy("ko").adjustDates, "날짜 조정");
  assert.equal(petFirstCopy("en").photoMonthCount, "%COUNT% photos");
  assert.equal(petFirstCopy("ko").photoMonthCount, "%COUNT%장");
  assert.equal(petFirstCopy("ko").todayCta, "오늘의 기억 남기기");
  assert.equal(petFirstCopy("ko").saved, "소중한 순간이 저장되었어요");
});

test("storybook copy avoids medical, healing or afterlife claims", () => {
  for (const lang of ["ko", "en"] as const) {
    const text = JSON.stringify(petFirstCopy(lang));
    assert.doesNotMatch(text, /치유|치료|우울|무지개다리|천국|heal|therapy|depress|heaven|rainbow bridge/i);
  }
});

test("fill replaces only known placeholders", () => {
  assert.equal(fill("%NAME% · %COUNT% · %OTHER%", { NAME: "콩이", COUNT: 3 }), "콩이 · 3 · %OTHER%");
});

test("month folder memory counts use localized singular and plural forms", () => {
  assert.equal(folderMemoryCount("en", 1), "1 memory");
  assert.equal(folderMemoryCount("en", 2), "2 memories");
  assert.equal(folderMemoryCount("ko", 1), "추억 1개");
  assert.equal(folderMemoryCount("ko", 2), "추억 2개");
});

test("dates use the owner-entered day and never guess", () => {
  assert.equal(timelineMonthKey({ happenedOn: null, createdAt: "2026-10-03T10:00:00Z" }), "2026-10");
  assert.equal(isSameDayLastYear({ happenedOn: "2025-10-31", createdAt: "2026-10-31T00:00:00Z" }, "2026-10-31"), true);
  assert.equal(isSameDayLastYear({ happenedOn: null, createdAt: "2025-10-31T00:00:00Z" }, "2026-10-31"), false);
  assert.equal(daysTogether("2026-10-31", "2026-10-31"), 1);
  assert.equal(daysTogether("2026-10-01", "2026-10-31"), 31);
  assert.equal(daysTogether(null, "2026-10-31"), null);
  assert.equal(daysTogether("2026-11-01", "2026-10-31"), null);
  assert.equal(seoulToday(new Date("2026-10-31T16:00:00Z")), "2026-11-01");
});

test("monthly card needs three real entries from that month", () => {
  const entry = (day: string) => ({ happenedOn: day, createdAt: `${day}T00:00:00Z` });
  assert.equal(monthlyCardReady([entry("2026-10-01"), entry("2026-10-02")], "2026-10"), false);
  assert.equal(monthlyCardReady([entry("2026-10-01"), entry("2026-10-02"), entry("2026-10-03")], "2026-10"), true);
});

test("memorial room sends no reminders and checkout is absent from the album screens", () => {
  const memory = readFileSync("components/pet-first-memory.tsx", "utf8");
  const home = readFileSync("components/pet-first-home.tsx", "utf8");
  assert.match(memory, /copy\.memorialQuiet/);
  assert.match(memory, /status === "memorial"/);
  assert.doesNotMatch(`${memory}\n${home}`, /checkout|stripe|toss|payment_intent|Notification\.requestPermission/i);
});
