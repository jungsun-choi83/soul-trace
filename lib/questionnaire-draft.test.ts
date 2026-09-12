import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  parseQuestionnaireDraft,
  questionnaireDraftKey,
  type QuestionnaireDraft,
} from "./questionnaire-draft.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

const pensionDraft: QuestionnaireDraft = {
  version: 1,
  mode: "living",
  channel: "pension",
  questionIndex: 8,
  petIntro: {
    petName: "Coco",
    petNickname: "Coco bean",
    petType: "dog",
    petBreed: "Poodle",
    petAge: "5",
    yearMet: "",
    yearParted: "2026",
    letterRecipient: "mom",
    letterRecipientDetail: "",
  },
  memoryAnswers: ["waits near the door", "happy", "walks", "small bark"],
  tonePrefs: { mood: "warm", options: [], length: "normal" },
  petPhotoSkipped: true,
  privacyConsent: true,
};

test("draft keys isolate canonical mode and channel contexts", () => {
  assert.equal(questionnaireDraftKey("living", "pension"), "soul-trace-draft:v1:living:pension");
  assert.equal(questionnaireDraftKey("living", "grooming"), "soul-trace-draft:v1:living:grooming");
  assert.equal(questionnaireDraftKey("living", null), "soul-trace-draft:v1:living:direct");
  assert.equal(questionnaireDraftKey("memorial", null), "soul-trace-draft:v1:memorial:direct");
});

test("valid draft restores pet details, answers, preferences, consent, and exact question", () => {
  assert.deepEqual(
    parseQuestionnaireDraft(JSON.stringify(pensionDraft), "living", "pension"),
    pensionDraft,
  );
});

test("another channel or mode cannot restore the draft", () => {
  const serialized = JSON.stringify(pensionDraft);
  assert.equal(parseQuestionnaireDraft(serialized, "living", "grooming"), null);
  assert.equal(parseQuestionnaireDraft(serialized, "memorial", null), null);
});

test("malformed and unsupported drafts are ignored", () => {
  assert.equal(parseQuestionnaireDraft("not json", "living", "pension"), null);
  assert.equal(
    parseQuestionnaireDraft(JSON.stringify({ ...pensionDraft, questionIndex: -1 }), "living", "pension"),
    null,
  );
  assert.equal(
    parseQuestionnaireDraft(JSON.stringify({ ...pensionDraft, version: 2 }), "living", "pension"),
    null,
  );
  assert.equal(
    parseQuestionnaireDraft(
      JSON.stringify({ ...pensionDraft, channel: "unknown" }),
      "living",
      null,
    ),
    null,
  );
});

test("client flow restores before rendering and saves only meaningful unfinished progress", () => {
  assert.match(flow, /window\.sessionStorage\.getItem\(draftStorageKey\)/);
  assert.match(flow, /window\.sessionStorage\.setItem\(draftStorageKey, JSON\.stringify\(draft\)\)/);
  assert.match(flow, /if \(!draftReady\)/);
  assert.match(flow, /setQuestionIndex\(Math\.min\(restored\.questionIndex/);
  assert.match(flow, /memoryAnswers\.some\(Boolean\)/);
});

test("successful completion and explicit restart clear only the active draft", () => {
  assert.match(flow, /window\.sessionStorage\.removeItem\(draftStorageKey\)/);
  assert.match(flow, /onDone: \(data\) => \{[\s\S]*?persistCompletedResult\(completedResult\);\s*clearQuestionnaireDraft\(\)/);
  assert.match(flow, /const resetTest = \(\) => \{\s*clearQuestionnaireDraft\(\)/);
});
