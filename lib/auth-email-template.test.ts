import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const signup = readFileSync("supabase/email-templates/confirm-signup.html", "utf8");
const signupSubject = readFileSync("supabase/email-templates/confirm-signup-subject.txt", "utf8");
const magicLink = readFileSync("supabase/email-templates/magic-link.html", "utf8");
const instructions = readFileSync("supabase/email-templates/README.md", "utf8");

test("confirm signup template contains the complete English welcome", () => {
  assert.match(signupSubject, /Welcome to Soul Trace — Your Story Begins Here/);
  assert.match(signup, /Every bond leaves a trace\./);
  assert.match(signup, /Soul Trace is an Eternal Beam experience created to preserve/);
  assert.match(signup, /Confirm your email and begin your Soul Trace journey\./);
  assert.match(signup, /The Eternal Beam Team/);
});

test("confirm signup template contains the complete Korean welcome", () => {
  assert.match(signupSubject, /Soul Trace에 오신 것을 환영합니다 — 소중한 이야기가 시작됩니다/);
  assert.match(signup, /모든 인연은 마음속에 흔적을 남깁니다\./);
  assert.match(signup, /Eternal Beam이 만든 서비스입니다\./);
  assert.match(signup, /이메일을 확인하고 Soul Trace 여정을 시작해 주세요\./);
  assert.match(signup, /Eternal Beam 드림/);
});

test("both signup buttons use only Supabase's confirmation URL", () => {
  assert.match(signup, /href="\{\{ \.ConfirmationURL \}\}"[^>]*>Soul Trace 시작하기<\/a>/);
  assert.match(signup, /href="\{\{ \.ConfirmationURL \}\}"[^>]*>Enter Soul Trace<\/a>/);
  assert.equal((signup.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length, 2);
  assert.doesNotMatch(signup, /href="(?:\/|https?:\/\/|localhost)/i);
});

test("returning-user template is bilingual and does not welcome a new member", () => {
  assert.match(magicLink, /Continue to Soul Trace/);
  assert.match(magicLink, /Soul Trace로 계속하기/);
  assert.match(magicLink, /ETERNAL BEAM/);
  assert.equal((magicLink.match(/href="\{\{ \.ConfirmationURL \}\}"/g) ?? []).length, 2);
  assert.doesNotMatch(magicLink, /Your Story Begins Here|소중한 이야기가 시작됩니다/);
});

test("repository instructions identify the manual dashboard step", () => {
  assert.match(instructions, /Authentication → Email Templates → Confirm signup/);
  assert.match(instructions, /do not update hosted Supabase/i);
});
