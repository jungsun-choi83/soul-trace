import assert from "node:assert/strict";
import test from "node:test";

import {
  isServiceChannelCompatible,
  isCustomizedServiceChannel,
  parseServiceChannel,
  serviceChannelMode,
  type ServiceChannel,
} from "./service-channel.ts";

test("accepts all supported service channels", () => {
  for (const channel of ["pension", "grooming", "hospital", "funeral"]) {
    assert.equal(parseServiceChannel(channel), channel);
  }
});

test("only living service channels customize questionnaire and prompt content", () => {
  assert.equal(isCustomizedServiceChannel("pension"), true);
  assert.equal(isCustomizedServiceChannel("grooming"), true);
  assert.equal(isCustomizedServiceChannel("hospital"), true);
  assert.equal(isCustomizedServiceChannel("funeral"), false);
  assert.equal(isCustomizedServiceChannel(null), false);
});

test("rejects missing, empty, and unknown values", () => {
  assert.equal(parseServiceChannel(undefined), null);
  assert.equal(parseServiceChannel(null), null);
  assert.equal(parseServiceChannel(""), null);
  assert.equal(parseServiceChannel("unknown"), null);
  assert.equal(parseServiceChannel("GROOMING"), null);
  assert.equal(parseServiceChannel(42), null);
});

test("maps each service channel to the existing letter mode", () => {
  const expected: Record<ServiceChannel, "living" | "memorial"> = {
    pension: "living",
    grooming: "living",
    hospital: "living",
    funeral: "memorial",
  };
  for (const [channel, mode] of Object.entries(expected) as [ServiceChannel, "living" | "memorial"][]) {
    assert.equal(serviceChannelMode(channel), mode);
  }
});

test("checks channel and letter-mode compatibility", () => {
  assert.equal(isServiceChannelCompatible("grooming", "memorial"), false);
  assert.equal(isServiceChannelCompatible("pension", "memorial"), false);
  assert.equal(isServiceChannelCompatible("hospital", "memorial"), false);
  assert.equal(isServiceChannelCompatible("funeral", "living"), false);
  assert.equal(isServiceChannelCompatible("pension", "living"), true);
  assert.equal(isServiceChannelCompatible("grooming", "living"), true);
  assert.equal(isServiceChannelCompatible("hospital", "living"), true);
  assert.equal(isServiceChannelCompatible("funeral", "memorial"), true);
});
