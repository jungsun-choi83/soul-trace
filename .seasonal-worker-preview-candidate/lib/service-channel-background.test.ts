import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { serviceChannelBackground } from "./service-channel-background.ts";

const flow = readFileSync("components/soul-trace-flow.tsx", "utf8");

const expected = {
  pension: "/images/channel-backgrounds/pension-bg.webp",
  grooming: "/images/channel-backgrounds/grooming-bg.webp",
  hospital: "/images/channel-backgrounds/hospital-bg.webp",
  funeral: "/images/channel-backgrounds/memorial-bg.webp",
} as const;

test("each validated service channel maps to its decorative background", () => {
  for (const [channel, image] of Object.entries(expected)) {
    assert.equal(
      serviceChannelBackground(channel as keyof typeof expected),
      image,
    );
    assert.ok(existsSync(`public${image}`), `${image} must exist`);
  }
});

test("normal living and memorial flows have no channel background", () => {
  assert.equal(serviceChannelBackground(null), null);
  assert.equal(serviceChannelBackground(undefined), null);
});

test("flow keeps one fixed non-interactive layer through loading and excludes results", () => {
  assert.match(
    flow,
    /channelBackground !== null && \(!result \|\| generationLoadingMessage !== null\)/,
  );
  assert.match(flow, /data-service-channel-background=\{serviceChannel\}/);
  assert.match(flow, /pointer-events-none fixed inset-0 z-0 bg-cover bg-no-repeat/);
  assert.match(flow, /backgroundPosition: "center top"/);
  assert.match(flow, /showChannelBackground \? "bg-transparent" : "bg-black"/);
  assert.doesNotMatch(flow, /background-attachment|window\.location\.search.*channel/);
});
