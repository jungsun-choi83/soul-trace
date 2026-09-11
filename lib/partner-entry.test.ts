import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import { partnerEntryDestination, partnerEntryPath } from "./partner-entry.ts";

const CODE = "partner_code_123";

test("general QR keeps the normal Welcome to auth to choose journey", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  assert.match(page, /candidate !== undefined/);
  assert.match(page, /hrefWithSearchParams\("\/choose", params\)/);
  assert.match(page, /choiceHref=\{authEntryPath\(choiceHref\)\}/);
  assert.doesNotMatch(page, /destination=.*pension/);
});

test("the four trusted partner types derive their exact service destinations", () => {
  assert.equal(partnerEntryDestination("PENSION", CODE, { p: CODE }), `/living?p=${CODE}&ch=pension`);
  assert.equal(partnerEntryDestination("GROOMING", CODE, { p: CODE }), `/living?p=${CODE}&ch=grooming`);
  assert.equal(partnerEntryDestination("HOSPITAL", CODE, { p: CODE }), `/living?p=${CODE}&ch=hospital`);
  assert.equal(partnerEntryDestination("FUNERAL", CODE, { p: CODE }), `/memorial?p=${CODE}&ch=funeral`);
});

test("signed-out partner entries use auth while authenticated entries go directly", () => {
  const destination = `/living?p=${CODE}&ch=hospital`;
  assert.equal(partnerEntryPath(destination, false), `/auth?returnTo=%2Fliving%3Fp%3D${CODE}%26ch%3Dhospital`);
  assert.equal(partnerEntryPath(destination, true), destination);
});

test("trusted partner code, repeated safe parameters, and fragments survive entry", () => {
  const destination = partnerEntryDestination("PENSION", CODE, {
    p: "untrusted-replacement",
    ch: ["funeral", "hospital"],
    campaign: ["one", "two"],
    source: "poster",
  });
  assert.equal(destination, `/living?p=${CODE}&ch=pension&campaign=one&campaign=two&source=poster`);
  assert.equal(
    partnerEntryPath(destination, false, "#questions"),
    `/auth?returnTo=%2Fliving%3Fp%3D${CODE}%26ch%3Dpension%26campaign%3Done%26campaign%3Dtwo%26source%3Dposter%23questions`,
  );
});

test("unknown and inactive partners use a localized safe fallback", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const fallback = readFileSync("components/partner-entry-fallback.tsx", "utf8");
  assert.match(page, /if \(!partner\) return <PartnerEntryFallback/);
  assert.match(fallback, /href="\/"/);
  assert.ok(en.partnerEntry.unavailableTitle);
  assert.ok(ko.partnerEntry.unavailableTitle);
  assert.notEqual(en.partnerEntry.unavailableTitle, ko.partnerEntry.unavailableTitle);
});

test("printed root partner links remain the compatible entry contract", () => {
  const api = readFileSync("lib/partner.ts", "utf8");
  assert.equal(new URL(`https://soul-trace-kappa.vercel.app/?p=${CODE}`).pathname, "/");
  assert.match(api, /PARTNER_CODE_PARAM = "p"/);
});
