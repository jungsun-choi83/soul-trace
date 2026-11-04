import type { CollarConfig, DeviceLink, TransferEvent } from "./collar-config.ts";

export type DeviceSnapshot = {
  link: DeviceLink;
  deviceId: string | null;
  batteryPercent: number | null;
  firmware: string | null;
  simulated: boolean;
};

export type TransferProgress = { event: TransferEvent; progress: number };

export type TransferHandle = { cancel: () => void };

/**
 * Boundary between the collar UI and a device. A future BLE implementation
 * (react-native-ble-plx or Web Bluetooth) must emit `device_ack` only after the
 * firmware confirms the payload.
 */
export interface CollarTransport {
  readonly kind: "simulated" | "ble";
  status(): DeviceSnapshot;
  connect(): Promise<DeviceSnapshot>;
  disconnect(): Promise<DeviceSnapshot>;
  send(config: CollarConfig, onProgress: (update: TransferProgress) => void): TransferHandle;
}

export const DISCONNECTED: DeviceSnapshot = { link: "unpaired", deviceId: null, batteryPercent: null, firmware: null, simulated: false };

export function encodeCollarPayload(config: CollarConfig): string {
  return JSON.stringify({
    v: config.version,
    face: config.face,
    top: config.top,
    bottom: config.bottom,
    brightness: config.brightness,
    wake: config.wake,
    asset: config.assetId,
  });
}

type Timer = (callback: () => void, ms: number) => unknown;
type ClearTimer = (handle: unknown) => void;

export function createSimulatedCollarTransport(options: {
  stepMs?: number;
  failSend?: boolean;
  setTimer?: Timer;
  clearTimer?: ClearTimer;
} = {}): CollarTransport {
  const stepMs = options.stepMs ?? 600;
  const setTimer: Timer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer: ClearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let snapshot: DeviceSnapshot = DISCONNECTED;

  return {
    kind: "simulated",
    status() {
      return snapshot;
    },
    async connect() {
      snapshot = { link: "connected", deviceId: "sim-collar-01", batteryPercent: 82, firmware: "sim-0.1", simulated: true };
      return snapshot;
    },
    async disconnect() {
      snapshot = DISCONNECTED;
      return snapshot;
    },
    send(_config, onProgress) {
      const timers: unknown[] = [];
      let canceled = false;
      const schedule = (index: number, update: TransferProgress) => {
        timers.push(setTimer(() => {
          if (!canceled) onProgress(update);
        }, stepMs * index));
      };
      if (snapshot.link !== "connected") {
        schedule(0, { event: "error", progress: 0 });
        return { cancel() {} };
      }
      schedule(0, { event: "enqueue", progress: 0 });
      schedule(1, { event: "start", progress: 10 });
      if (options.failSend) {
        schedule(2, { event: "error", progress: 40 });
      } else {
        schedule(2, { event: "chunks_done", progress: 100 });
        schedule(3, { event: "device_ack", progress: 100 });
      }
      return {
        cancel() {
          canceled = true;
          for (const timer of timers) clearTimer(timer);
          onProgress({ event: "cancel", progress: 0 });
        },
      };
    },
  };
}
