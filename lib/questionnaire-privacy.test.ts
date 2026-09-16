import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import { allPrivacyItemsAgreed, EMPTY_PRIVACY_SELECTIONS, requiredPrivacyItemsAgreed, setAllPrivacyItems } from "./privacy-consent-selection.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");
const notice = readFileSync("components/questionnaire-privacy-notice.tsx", "utf8");
const generateRoute = readFileSync("app/api/generate-letter/route.ts", "utf8");

test("country residence is completely removed and progress goes from survey to email", () => {
  assert.doesNotMatch(flow, /CountryOfResidence|residenceQuestionIndex|isResidenceQuestion|setResidence/);
  assert.doesNotMatch(generateRoute, /isPrivacyResidence|country of residence|body\.residence/);
  assert.match(flow, /emailQuestionIndex = introQuestionCount \+ surveyStepCount/);
  assert.match(flow, /totalQuestionCount = emailQuestionIndex \+ 1/);
});

test("Stamp Photo Next opens the consent modal before Email", () => {
  assert.match(flow, /isStampPhotoQuestion = PHOTO_STEP_COUNT === 1/);
  assert.match(flow, /if \(isStampPhotoQuestion\) \{[\s\S]*?setPrivacyModalOpen\(true\);\s*return;/);
  assert.match(flow, /privacyModalOpen \? \([\s\S]*?<QuestionnairePrivacyNotice/);
  assert.doesNotMatch(flow, /onSkipPhoto=\{submitAnswers\}/);
});

test("only privacy consent is required and optional choices do not block", () => {
  assert.equal(requiredPrivacyItemsAgreed({ privacy: false, marketing: true, aiImprovement: true }), false);
  assert.equal(requiredPrivacyItemsAgreed({ privacy: true, marketing: false, aiImprovement: false }), true);
  assert.match(notice, /disabled=\{!requiredAgreed\}/);
  assert.doesNotMatch(notice, /disagree|type="radio"/);
});

test("AI improvement stays optional because no prior required rule exists", () => {
  assert.equal(requiredPrivacyItemsAgreed({ privacy: true, marketing: false, aiImprovement: false }), true);
  assert.match(readFileSync("lib/privacy-consent-selection.ts", "utf8"), /does not mark AI-improvement consent as required/);
});

test("Agree All checks and unchecks all and reflects manual selections", () => {
  assert.deepEqual(setAllPrivacyItems(true), { privacy: true, marketing: true, aiImprovement: true });
  assert.deepEqual(setAllPrivacyItems(false), EMPTY_PRIVACY_SELECTIONS);
  assert.equal(allPrivacyItemsAgreed(setAllPrivacyItems(true)), true);
  assert.equal(allPrivacyItemsAgreed({ ...setAllPrivacyItems(true), marketing: false }), false);
  assert.match(notice, /checked=\{allAgreed\}[\s\S]*?onAgreeAll\(event\.target\.checked\)/);
});

test("exact English and natural Korean copy is localized", () => {
  assert.equal(en.form.consents.title, "Before We Continue");
  assert.equal(en.form.consents.privacy, "I agree to the Privacy Policy and consent to my questionnaire answers being used to generate my pet's AI letter. (Required)");
  assert.equal(en.form.consents.marketing, "I want to receive email updates, exclusive launch offers, and marketing announcements from Eternal Beam. (Optional)");
  assert.equal(en.form.consents.aiImprovement, "I consent to my pet's photo, pet details, and my written answers being used to help develop and improve AI features across Eternal Beam services.");
  assert.equal(ko.form.consents.title, "계속하기 전에 확인해 주세요");
  assert.equal(ko.form.consents.policyLink, "개인정보 처리방침");
  assert.match(ko.form.consents.privacy, /AI 편지를 만드는 데 사용되는 것에 동의합니다\. \(필수\)$/);
  assert.match(ko.form.consents.marketing, /Eternal Beam.*\(선택\)$/);
});

test("policy opens separately and modal state remains mounted", () => {
  assert.match(notice, /href="\/privacy-policy" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(notice, /setPrivacySelections|onSelectionChange\([^)]*false\).*policy/);
});

test("modal is accessible, closable and internally scrollable on mobile", () => {
  assert.match(notice, /role="dialog" aria-modal="true"/);
  assert.match(notice, /max-h-\[calc\(100dvh-1\.5rem\)\]/);
  assert.match(notice, /min-h-0 flex-1 space-y-4 overflow-y-auto/);
  assert.match(notice, /type="checkbox"/);
  assert.match(notice, /event\.key === "Escape"/);
  assert.match(notice, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(flow, /privacyTriggerRef\.current = document\.activeElement/);
  assert.match(flow, /requestAnimationFrame\(\(\) => privacyTriggerRef\.current\?\.focus\(\)\)/);
});

test("nothing reaches generation or stamp storage before required consent", () => {
  const submit = flow.slice(flow.indexOf("const submitAnswers"), flow.indexOf("const captureImage"));
  assert.match(submit, /if \(!privacyConsent\)[\s\S]*?setPrivacyModalOpen\(true\)[\s\S]*?return;/);
  assert.match(submit, /fetch\("\/api\/generate-letter"/);
  assert.ok(submit.indexOf("if (!privacyConsent)") < submit.indexOf('fetch("/api/generate-letter"'));
  assert.match(generateRoute, /body\.privacyConsent !== true/);
  assert.match(flow, /void persistStampSelection\(data\.letterId\)/);
});

test("closing and language changes preserve answers, photo, and selections", () => {
  assert.match(flow, /closePrivacyNotice = useCallback\(\(\) => \{[\s\S]*?setPrivacyModalOpen\(false\)/);
  assert.match(flow, /onBack=\{closePrivacyNotice\}/);
  assert.match(flow, /privacySelections,[\s\S]*?window\.sessionStorage\.setItem/);
  assert.doesNotMatch(notice, /setPet|setMemory|setPhoto|fetch\(/);
});
