import assert from "node:assert/strict";
import test from "node:test";

import { letterModePath } from "./letter-mode.ts";
import {
  isServiceChannelCompatible,
  parseServiceChannel,
  serviceChannelMode,
} from "./service-channel.ts";

function destinationFor(url: string, mode: "living" | "memorial") {
  const current = new URL(url);
  const channel = parseServiceChannel(current.searchParams.get("ch"));
  if (!channel || isServiceChannelCompatible(channel, mode)) return null;
  const destination = new URL(current);
  destination.pathname = letterModePath(serviceChannelMode(channel));
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

test("valid channel on the wrong route redirects while preserving query parameters", () => {
  assert.equal(
    destinationFor("https://example.test/memorial?ch=pension&p=partner-code&campaign=fall#questions", "memorial"),
    "/living?ch=pension&p=partner-code&campaign=fall#questions",
  );
  assert.equal(
    destinationFor("https://example.test/memorial?p=partner-code&ch=grooming", "memorial"),
    "/living?p=partner-code&ch=grooming",
  );
  assert.equal(
    destinationFor("https://example.test/memorial?ch=hospital&p=partner-code", "memorial"),
    "/living?ch=hospital&p=partner-code",
  );
  assert.equal(
    destinationFor("https://example.test/living?ch=funeral&p=funeral-partner-code", "living"),
    "/memorial?ch=funeral&p=funeral-partner-code",
  );
});

test("missing or invalid channels do not redirect", () => {
  assert.equal(destinationFor("https://example.test/living", "living"), null);
  assert.equal(
    destinationFor("https://example.test/memorial?p=funeral-partner-code", "memorial"),
    null,
  );
  assert.equal(destinationFor("https://example.test/memorial?ch=", "memorial"), null);
  assert.equal(destinationFor("https://example.test/memorial?ch=unknown", "memorial"), null);
});

test("valid channels on their required routes do not redirect", () => {
  assert.equal(destinationFor("https://example.test/living?p=partner-code&ch=pension", "living"), null);
  assert.equal(destinationFor("https://example.test/living?ch=hospital", "living"), null);
  assert.equal(destinationFor("https://example.test/memorial?ch=funeral", "memorial"), null);
});
