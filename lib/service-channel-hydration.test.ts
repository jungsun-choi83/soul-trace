import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { memoryQuestionCount, PHOTO_STEP_COUNT, TONE_STEP_COUNT } from "./survey.ts";
import { parseServiceChannel } from "./service-channel.ts";

const livingPage = readFileSync("app/living/page.tsx", "utf8");
const memorialPage = readFileSync("app/memorial/page.tsx", "utf8");
const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

function totalQuestionCount(rawChannel: unknown): number {
  return memoryQuestionCount(parseServiceChannel(rawChannel)) + PHOTO_STEP_COUNT + TONE_STEP_COUNT;
}

test("server-provided channels select channel questions on the initial render", () => {
  assert.equal(totalQuestionCount("pension"), 7);
  assert.equal(totalQuestionCount("grooming"), 8);
  assert.equal(totalQuestionCount("hospital"), 7);
  assert.equal(totalQuestionCount("funeral"), 7);
});

test("missing and invalid channels keep the existing normal questionnaire", () => {
  assert.equal(totalQuestionCount(undefined), 7);
  assert.equal(totalQuestionCount("invalid"), 7);
});

test("legacy funeral alias hydrates with the normal memorial question count", () => {
  assert.equal(totalQuestionCount("funeral"), totalQuestionCount(undefined));
});

test("route pages await, validate, and pass the initial channel to the client flow", () => {
  for (const page of [livingPage, memorialPage]) {
    assert.match(page, /const params = await searchParams/);
    assert.match(page, /parseServiceChannel\(params\.ch\)/);
    assert.match(page, /initialServiceChannel=\{initialServiceChannel\}/);
  }
});

test("server and browser hydration use only the same initial channel prop", () => {
  assert.match(flow, /const serviceChannel = initialServiceChannel;/);
  assert.doesNotMatch(flow, /parseServiceChannel\(new URLSearchParams\(window\.location\.search\)/);
  assert.doesNotMatch(flow, /mounted|suppressHydrationWarning/);
});

test("existing client redirect keeps the complete query string, including partner code", () => {
  assert.match(flow, /const destination = new URL\(window\.location\.href\)/);
  assert.match(flow, /destination\.pathname = letterModePath\(serviceChannelMode\(serviceChannel\)\)/);
  assert.match(flow, /destination\.pathname\}\$\{destination\.search\}\$\{destination\.hash/);
});
