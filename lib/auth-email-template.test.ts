import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const signup = readFileSync("supabase/email-templates/confirm-signup.html", "utf8");
const signupSubject = readFileSync("supabase/email-templates/confirm-signup-subject.txt", "utf8");
const magicLink = readFileSync("supabase/email-templates/magic-link.html", "utf8");
const magicLinkSubject = readFileSync("supabase/email-templates/magic-link-subject.txt", "utf8");
const instructions = readFileSync("supabase/email-templates/README.md", "utf8");

function assertCodeEmail(template: string, subject: string) {
  assert.match(subject, /Soul Trace 인증번호/);
  assert.match(subject, /Your Soul Trace verification code/);
  assert.match(template, /인증번호/);
  assert.match(template, /Verification code/);
  assert.equal((template.match(/\{\{ \.Token \}\}/g) ?? []).length, 2);
  assert.doesNotMatch(template, /ConfirmationURL|soultrace\.pet|\/shop|href=/i);
}

test("confirm signup email is the 6-digit code, not a site link", () => {
  assertCodeEmail(signup, signupSubject);
});

test("magic link email is the 6-digit code, not a site link", () => {
  assertCodeEmail(magicLink, magicLinkSubject);
});

test("repository instructions identify the manual dashboard step", () => {
  assert.match(instructions, /Authentication → Email Templates → Confirm signup/);
  assert.match(instructions, /do not update hosted Supabase/i);
  assert.match(instructions, /\{\{ \.Token \}\}/);
});
