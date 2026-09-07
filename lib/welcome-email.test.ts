import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWelcomeEmail,
  displayNameFromEmail,
} from "./welcome-email-content.ts";

test("welcome email uses provided copy and Eternal Beam link", () => {
  process.env.NEXT_PUBLIC_ETERNALBEAM_HOME_URL = "https://eternalbeam.com";
  const en = buildWelcomeEmail("en", { userName: "Alex" });
  const ko = buildWelcomeEmail("ko", { userName: "수진" });

  assert.match(en.subject, /registration is complete/i);
  assert.match(en.html, /Hello Alex,/);
  assert.match(en.html, /Explore Eternal Beam/);
  assert.match(en.html, /https:\/\/eternalbeam\.com/);
  assert.match(en.text, /The Soul Trace Team/);

  assert.match(ko.subject, /등록이 완료/);
  assert.match(ko.html, /안녕하세요 수진님,/);
  assert.match(ko.html, /Eternal Beam 둘러보기/);
  assert.match(ko.html, /https:\/\/eternalbeam\.com/);
  assert.match(ko.text, /Soul Trace 팀/);
});

test("displayNameFromEmail cleans local part", () => {
  assert.equal(displayNameFromEmail("alex.kim+test@example.com"), "Alex Kim Test");
});
