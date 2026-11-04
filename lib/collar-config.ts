export type CollarFace = "video" | "steps" | "ring" | "minimal" | "photo";
export type OverlayMetric = "name" | "steps" | "elapsed" | "distance" | "battery" | "heart" | "none";
export type WakePolicy = "tap" | "raise" | "always";
export type TransferState = "draft" | "queued" | "transferring" | "awaiting_ack" | "applied" | "failed" | "canceled";
export type DeviceLink = "unpaired" | "connected" | "error";

export type CollarConfig = {
  deviceId: string | null;
  petId: string | null;
  face: CollarFace;
  top: OverlayMetric;
  bottom: OverlayMetric;
  brightness: number;
  wake: WakePolicy;
  assetId: string | null;
  version: number;
};

export const COLLAR_FACES: CollarFace[] = ["video", "steps", "ring", "minimal", "photo"];
export const OVERLAY_METRICS: OverlayMetric[] = ["name", "steps", "elapsed", "distance", "battery", "heart", "none"];
export const WAKE_POLICIES: WakePolicy[] = ["tap", "raise", "always"];

export const DEFAULT_COLLAR_CONFIG: CollarConfig = {
  deviceId: null,
  petId: null,
  face: "video",
  top: "name",
  bottom: "steps",
  brightness: 70,
  wake: "tap",
  assetId: null,
  version: 1,
};

export type CollarEdit =
  | { type: "face"; value: CollarFace }
  | { type: "top" | "bottom"; value: OverlayMetric }
  | { type: "brightness"; value: number }
  | { type: "wake"; value: WakePolicy };

export function editCollarConfig(config: CollarConfig, edit: CollarEdit): CollarConfig {
  switch (edit.type) {
    case "face":
      if (!COLLAR_FACES.includes(edit.value)) return config;
      return { ...config, face: edit.value, version: config.version + 1 };
    case "top":
    case "bottom":
      if (!OVERLAY_METRICS.includes(edit.value)) return config;
      return { ...config, [edit.type]: edit.value, version: config.version + 1 };
    case "brightness": {
      if (!Number.isFinite(edit.value)) return config;
      const value = Math.min(100, Math.max(10, Math.round(edit.value / 5) * 5));
      return { ...config, brightness: value, version: config.version + 1 };
    }
    case "wake":
      if (!WAKE_POLICIES.includes(edit.value)) return config;
      return { ...config, wake: edit.value, version: config.version + 1 };
  }
}

export type TransferEvent = "enqueue" | "start" | "chunks_done" | "device_ack" | "error" | "cancel" | "edit";

const TRANSITIONS: Record<TransferState, Partial<Record<TransferEvent, TransferState>>> = {
  draft: { enqueue: "queued" },
  queued: { start: "transferring", cancel: "canceled", edit: "draft" },
  transferring: { chunks_done: "awaiting_ack", error: "failed", cancel: "canceled" },
  awaiting_ack: { device_ack: "applied", error: "failed", cancel: "canceled" },
  applied: { edit: "draft" },
  failed: { enqueue: "queued", edit: "draft" },
  canceled: { enqueue: "queued", edit: "draft" },
};

/** "applied" is reachable only through a firmware ACK while awaiting it. */
export function nextTransferState(state: TransferState, event: TransferEvent): TransferState {
  return TRANSITIONS[state][event] ?? state;
}

export function canSendToDevice(link: DeviceLink, config: CollarConfig): boolean {
  return link === "connected" && config.deviceId !== null;
}

export function restoreCollarConfig(raw: string | null, petId: string | null): CollarConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const face = COLLAR_FACES.includes(parsed.face as CollarFace) ? parsed.face as CollarFace : null;
    const top = OVERLAY_METRICS.includes(parsed.top as OverlayMetric) ? parsed.top as OverlayMetric : null;
    const bottom = OVERLAY_METRICS.includes(parsed.bottom as OverlayMetric) ? parsed.bottom as OverlayMetric : null;
    const wake = WAKE_POLICIES.includes(parsed.wake as WakePolicy) ? parsed.wake as WakePolicy : null;
    if (!face || !top || !bottom || !wake) return null;
    const brightnessRaw = Number(parsed.brightness);
    if (!Number.isFinite(brightnessRaw)) return null;
    const brightness = Math.min(100, Math.max(10, Math.round(brightnessRaw / 5) * 5));
    const version = Number.isInteger(parsed.version) && (parsed.version as number) > 0 ? parsed.version as number : 1;
    return {
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : null,
      petId: petId ?? (typeof parsed.petId === "string" ? parsed.petId : null),
      face,
      top,
      bottom,
      brightness,
      wake,
      assetId: typeof parsed.assetId === "string" ? parsed.assetId : null,
      version,
    };
  } catch {
    return null;
  }
}

type Labels = {
  faces: Record<CollarFace, string>;
  metrics: Record<OverlayMetric, string>;
  wake: Record<WakePolicy, string>;
  transfer: Record<TransferState, string>;
  link: Record<DeviceLink, string>;
};

const KO_LABELS: Labels = {
  faces: { video: "영상형", steps: "걸음수형", ring: "산책 링형", minimal: "미니멀형", photo: "사진형" },
  metrics: { name: "우리 아이 이름", steps: "걸음수", elapsed: "산책 시간", distance: "이동 거리", battery: "배터리", heart: "산책 하트", none: "표시 안 함" },
  wake: { tap: "화면 터치", raise: "움직임 감지 (검증 예정)", always: "항상 켜짐 · 배터리 소모 큼" },
  transfer: { draft: "전송 전", queued: "보낼 준비 완료", transferring: "보내는 중", awaiting_ack: "기기 확인 기다리는 중", applied: "기기에 적용됨", failed: "보내지 못했어요", canceled: "취소했어요" },
  link: { unpaired: "미연결 · 개발 중", connected: "연결됨", error: "통신 오류" },
};

const EN_LABELS: Labels = {
  faces: { video: "Motion", steps: "Steps", ring: "Walk ring", minimal: "Minimal", photo: "Photo" },
  metrics: { name: "Pet name", steps: "Steps", elapsed: "Walk time", distance: "Distance", battery: "Battery", heart: "Walk heart", none: "Hidden" },
  wake: { tap: "Tap screen", raise: "Motion wake (to be verified)", always: "Always on · high battery use" },
  transfer: { draft: "Not sent", queued: "Ready to send", transferring: "Sending", awaiting_ack: "Waiting for device", applied: "Applied on device", failed: "Could not send", canceled: "Canceled" },
  link: { unpaired: "Not connected · in development", connected: "Connected", error: "Connection error" },
};

export function collarLabels(lang: "ko" | "en"): Labels {
  return lang === "en" ? EN_LABELS : KO_LABELS;
}
