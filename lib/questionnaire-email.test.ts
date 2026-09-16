import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import {
  isValidQuestionnaireEmail,
  normalizeQuestionnaireEmail,
} from "./questionnaire-email.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const welcome = readFileSync("app/page.tsx", "utf8");
const living = readFileSync("app/living/page.tsx", "utf8");
const memorial = readFileSync("app/memorial/page.tsx", "utf8");
const partnerRedirect = readFileSync("components/partner-entry-redirect.tsx", "utf8");
const generation = readFileSync("app/api/generate-letter/route.ts", "utf8");

test("Living can be entered without an authentication redirect", () => {
  assert.doesNotMatch(living, /authEntryPath|redirect\([^)]*auth|auth\.getUser/);
  assert.doesNotMatch(welcome, /authEntryPath|auth\.getUser/);
});

test("Memorial can be entered without an authentication redirect", () => {
  assert.doesNotMatch(memorial, /authEntryPath|redirect\([^)]*auth|auth\.getUser/);
  assert.match(welcome, /choiceHref=\{choiceHref\}/);
});

test("partner entries also bypass auth in the active journey", () => {
  assert.match(partnerRedirect, /window\.location\.replace\(`\$\{destination\}\$\{window\.location\.hash\}`\)/);
  assert.doesNotMatch(partnerRedirect, /partnerEntryPath\(/);
});

test("Email follows the required Privacy Notice step", () => {
  assert.match(flow, /emailQuestionIndex = introQuestionCount \+ surveyStepCount/);
  assert.match(flow, /totalQuestionCount = emailQuestionIndex \+ 1/);
  assert.match(flow, /isEmailQuestion = questionIndex === emailQuestionIndex/);
  assert.doesNotMatch(flow, /privacyQuestionIndex/);
  assert.match(flow, /setPrivacyModalOpen\(true\)/);
});

test("Stamp Photo does not directly trigger generation", () => {
  assert.match(flow, /isLastQuestion \? \([\s\S]*?onClick=\{submitAnswers\}/);
  assert.match(flow, /isEmailQuestion \? \(/);
  assert.doesNotMatch(flow, /onSkipPhoto=\{submitAnswers\}/);
});

test("invalid and blank emails are rejected", () => {
  for (const value of [
    "", "   ", "hello", "user@", "@gmail.com", "user@gmail", "user@@gmail.com",
    ".user@gmail.com", "user.@gmail.com", "user..name@gmail.com", "user name@gmail.com",
    "user@-gmail.com", "user@gmail-.com", "user@gmail..com", "user@gmail.c", "user@gmail.123",
    "12345@g.com", "12345@gmail.com", "user@g.com",
  ]) {
    assert.equal(isValidQuestionnaireEmail(value), false, value);
  }
});

test("ordinary legitimate email addresses are accepted", () => {
  for (const value of [
    "user@example.com", " First.Last+tag@Example.CO.KR ", "hello@sub.example.org",
    "customer-service@eternal-beam.co.kr",
  ]) {
    assert.equal(isValidQuestionnaireEmail(value), true, value);
  }
});

test("email is trimmed and normalized to lowercase", () => {
  assert.equal(normalizeQuestionnaireEmail(" User.Name@Example.COM "), "user.name@example.com");
});

test("Back from Email returns to Stamp Photo through the existing previous-step control", () => {
  assert.match(flow, /const goPrev = \(\) => \{[\s\S]*?setQuestionIndex\(\(prev\) => Math\.max\(prev - 1, 0\)\)/);
  assert.match(flow, /onClick=\{goPrev\}/);
});

test("entered email survives Back then Next navigation and is draft-persisted", () => {
  assert.match(flow, /const \[email, setEmail\] = useState\(""\)/);
  assert.match(flow, /value=\{email\}/);
  assert.match(flow, /email,\s*\};/);
  assert.match(flow, /setEmail\(restored\.email\)/);
});

test("existing questionnaire and photo state are not reset during navigation", () => {
  assert.doesNotMatch(flow, /const go(?:Next|Prev)[\s\S]{0,400}set(?:PetIntro|MemoryAnswers|TonePrefs|PetPhotoFile)/);
});

test("Reveal the Letter is the sole visible final generation action", () => {
  assert.equal(en.buttons.generate, "Reveal the Letter");
  assert.equal(ko.buttons.generate, "편지 확인하기");
  assert.match(flow, /onClick=\{submitAnswers\}/);
});

test("normalized email is included in the generation request", () => {
  assert.match(flow, /email: normalizedEmail,[\s\S]*?stream: true/);
  assert.match(generation, /email\?: string/);
  assert.match(generation, /const submittedEmail = normalizeQuestionnaireEmail\(body\.email \?\? ""\)/);
});

test("email validation is enforced in both UI and server paths", () => {
  assert.match(flow, /isValidQuestionnaireEmail\(email\)/);
  assert.match(flow, /maxLength=\{254\}/);
  assert.match(generation, /isValidQuestionnaireEmail\(submittedEmail\)/);
});

test("English Email screen keeps only the field copy", () => {
  assert.deepEqual(en.form.emailStep, {
    kicker: "EMAIL ADDRESS",
    label: "Email address",
    placeholder: "Enter email to reveal the letter",
    validation: "Please enter a valid email address.",
  });
});

test("Korean Email screen keeps only the natural field copy", () => {
  assert.deepEqual(ko.form.emailStep, {
    kicker: "이메일 주소",
    label: "이메일 주소",
    placeholder: "편지를 확인하려면 이메일을 입력해 주세요",
    validation: "올바른 이메일 주소를 입력해주세요.",
  });
  assert.equal(ko.buttons.prev, "이전");
  assert.equal(ko.buttons.next, "다음");
  assert.doesNotMatch(flow, /form\.emailStep\.(?:title|helper)/);
  assert.doesNotMatch(flow, /<label htmlFor="questionnaire-email"/);
  assert.match(flow, /aria-label=\{t\("form\.emailStep\.label"\)\}/);
});

test("backend uses the normalized questionnaire email without requiring auth", () => {
  assert.match(generation, /normalizeQuestionnaireEmail\(body\.email \?\? ""\)/);
  assert.match(generation, /const userEmail = submittedEmail/);
  assert.match(generation, /email owner lookup/);
  assert.doesNotMatch(generation, /auth\.getUser\(\)|status: 401|Please sign in to continue/);
});
