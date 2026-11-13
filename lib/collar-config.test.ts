import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canSendToDevice,
  collarLabels,
  DEFAULT_COLLAR_CONFIG,
  editCollarConfig,
  nextTransferState,
  restoreCollarConfig,
  type TransferEvent,
  type TransferState,
} from "./collar-config.ts";
import { createSimulatedCollarTransport, encodeCollarPayload } from "./collar-transport.ts";

test("one shared config carries face, overlays, brightness and wake to the summary", () => {
  let config = editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "face", value: "ring" });
  config = editCollarConfig(config, { type: "top", value: "heart" });
  config = editCollarConfig(config, { type: "bottom", value: "none" });
  config = editCollarConfig(config, { type: "brightness", value: 43 });
  config = editCollarConfig(config, { type: "wake", value: "always" });
  assert.deepEqual(
    { face: config.face, top: config.top, bottom: config.bottom, brightness: config.brightness, wake: config.wake },
    { face: "ring", top: "heart", bottom: "none", brightness: 45, wake: "always" },
  );
  assert.equal(config.version, DEFAULT_COLLAR_CONFIG.version + 5);
});

test("brightness stays within 10-100 and invalid edits are ignored", () => {
  assert.equal(editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "brightness", value: 2 }).brightness, 10);
  assert.equal(editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "brightness", value: 250 }).brightness, 100);
  assert.equal(editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "brightness", value: Number.NaN }), DEFAULT_COLLAR_CONFIG);
  // @ts-expect-error runtime guard against unknown faces
  assert.equal(editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "face", value: "hologram" }), DEFAULT_COLLAR_CONFIG);
});

test("applied is reachable only through a device ACK while awaiting it", () => {
  const states: TransferState[] = ["draft", "queued", "transferring", "awaiting_ack", "applied", "failed", "canceled"];
  const events: TransferEvent[] = ["enqueue", "start", "chunks_done", "device_ack", "error", "cancel", "edit"];
  for (const state of states) {
    for (const event of events) {
      const next = nextTransferState(state, event);
      if (next === "applied" && state !== "applied") {
        assert.equal(state, "awaiting_ack");
        assert.equal(event, "device_ack");
      }
    }
  }
  assert.equal(nextTransferState("transferring", "device_ack"), "transferring");
  assert.equal(nextTransferState("draft", "device_ack"), "draft");
});

test("sending requires a connected, identified device", () => {
  assert.equal(canSendToDevice("unpaired", DEFAULT_COLLAR_CONFIG), false);
  assert.equal(canSendToDevice("connected", DEFAULT_COLLAR_CONFIG), false);
  assert.equal(canSendToDevice("connected", { ...DEFAULT_COLLAR_CONFIG, deviceId: "dev-1" }), true);
  assert.equal(canSendToDevice("error", { ...DEFAULT_COLLAR_CONFIG, deviceId: "dev-1" }), false);
});

test("saved collar settings restore the same face, overlays, brightness and wake", () => {
  const saved = editCollarConfig(
    editCollarConfig(
      editCollarConfig(DEFAULT_COLLAR_CONFIG, { type: "face", value: "photo" }),
      { type: "top", value: "battery" },
    ),
    { type: "brightness", value: 55 },
  );
  const restored = restoreCollarConfig(JSON.stringify(saved), "pet-1");
  assert.equal(restored?.face, "photo");
  assert.equal(restored?.top, "battery");
  assert.equal(restored?.brightness, 55);
  assert.equal(restored?.petId, "pet-1");
  assert.equal(restoreCollarConfig("{", null), null);
  assert.equal(restoreCollarConfig(JSON.stringify({ face: "hologram" }), null), null);
});

test("simulated transport reaches applied only after a device ACK", async () => {
  const events: string[] = [];
  const transport = createSimulatedCollarTransport({
    stepMs: 1,
    setTimer: (callback) => {
      callback();
      return 0;
    },
    clearTimer: () => {},
  });
  const unconnected = createSimulatedCollarTransport({
    setTimer: (callback) => {
      callback();
      return 0;
    },
    clearTimer: () => {},
  });
  unconnected.send(DEFAULT_COLLAR_CONFIG, ({ event }) => events.push(`off:${event}`));
  await transport.connect();
  transport.send(DEFAULT_COLLAR_CONFIG, ({ event }) => events.push(event));
  assert.deepEqual(events, ["off:error", "enqueue", "start", "chunks_done", "device_ack"]);
  assert.match(encodeCollarPayload({ ...DEFAULT_COLLAR_CONFIG, face: "ring" }), /"face":"ring"/);
});

test("collar copy never promises Wi-Fi delivery or live location tracking", () => {
  const studio = readFileSync("components/collar-studio.tsx", "utf8");
  const transport = readFileSync("lib/collar-transport.ts", "utf8");
  const text = `${studio}\n${transport}\n${JSON.stringify(collarLabels("ko"))}\n${JSON.stringify(collarLabels("en"))}`;
  assert.doesNotMatch(text, /Wi-?Fi|와이파이|실시간 위치|real-?time location|live tracking/i);
  assert.match(studio, /disabled=\{!sendable\}/);
  assert.match(studio, /PATHS\.send/);
  assert.match(transport, /kind: "simulated" \| "ble"/);
  assert.match(transport, /status\(\): DeviceSnapshot/);
});

test("memorial home hides walk and collar prompts", () => {
  const home = readFileSync("components/pet-first-home.tsx", "utf8");
  const memory = readFileSync("components/pet-first-memory.tsx", "utf8");
  assert.match(home, /!memorial \? \([\s\S]*walk-title/);
  assert.match(home, /!memorial \? \([\s\S]*collarCardTitle/);
  assert.match(readFileSync("components/pet-roster.tsx", "utf8"), /lifeStatus === "living"[\s\S]*\/my\/device\?pet=/);
  // The memorial-space entry point moved to components/pet-first-profile.tsx,
  // which still calls canOpenMemorialSpace (see lib/memory-library.test.ts).
  // This screen keeps the equivalent inline gate on the same life status.
  assert.match(memory, /status === "memorial"/);
  assert.match(memory, /memorialSpaceHref\(petId\)/);
  assert.doesNotMatch(memory, /\/my\/device\?pet=/);
  assert.doesNotMatch(memory, /href=["']\/my\/collar["']/);
});
