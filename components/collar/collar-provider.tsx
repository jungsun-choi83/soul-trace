"use client";

import {
  canSendToDevice,
  DEFAULT_COLLAR_CONFIG,
  editCollarConfig,
  nextTransferState,
  restoreCollarConfig,
  type CollarConfig,
  type CollarEdit,
  type TransferState,
} from "@/lib/collar-config";
import { createSimulatedCollarTransport, DISCONNECTED, encodeCollarPayload, type CollarTransport, type DeviceSnapshot, type TransferHandle } from "@/lib/collar-transport";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";

const SESSION_KEY = "soultrace.collar.config.v1";
const sharedSimulatedTransport = createSimulatedCollarTransport();
let memoryConfig: CollarConfig | null = null;

type CollarPet = { petId: string; petName: string } | null;

type CollarContextValue = {
  pet: CollarPet;
  config: CollarConfig;
  edit: (edit: CollarEdit) => void;
  device: DeviceSnapshot;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  transfer: TransferState;
  progress: number;
  lastSyncAt: string | null;
  sentVersion: number | null;
  send: () => void;
  cancel: () => void;
  simulated: boolean;
};

const CollarContext = createContext<CollarContextValue | null>(null);

type ConfigAction = CollarEdit | { type: "restore"; value: CollarConfig };

function configReducer(state: CollarConfig, action: ConfigAction): CollarConfig {
  return action.type === "restore" ? action.value : editCollarConfig(state, action);
}

export function CollarProvider({ pet, children, transport }: { pet: CollarPet; children: ReactNode; transport?: CollarTransport }) {
  const transportRef = useRef<CollarTransport>(transport ?? sharedSimulatedTransport);
  const handleRef = useRef<TransferHandle | null>(null);
  const [config, dispatch] = useReducer(configReducer, null, () => {
    const fallback = { ...DEFAULT_COLLAR_CONFIG, petId: pet?.petId ?? null };
    return memoryConfig ? { ...memoryConfig, petId: pet?.petId ?? memoryConfig.petId } : fallback;
  });
  const [device, setDevice] = useState<DeviceSnapshot>(() => transportRef.current.status());
  const [connecting, setConnecting] = useState(false);
  const [transfer, setTransfer] = useState<TransferState>("draft");
  const [progress, setProgress] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [sentVersion, setSentVersion] = useState<number | null>(null);
  const skipPersist = useRef(true);

  useEffect(() => {
    if (!memoryConfig) {
      const saved = restoreCollarConfig(window.sessionStorage.getItem(SESSION_KEY), pet?.petId ?? null);
      if (saved) {
        memoryConfig = saved;
        dispatch({ type: "restore", value: saved });
      }
    }
    skipPersist.current = false;
  }, [pet?.petId]);

  useEffect(() => {
    if (skipPersist.current) return;
    memoryConfig = config;
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => () => handleRef.current?.cancel(), []);

  const edit = useCallback((change: CollarEdit) => {
    dispatch(change);
    setTransfer((current) => nextTransferState(current, "edit"));
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      setDevice(await transportRef.current.connect());
    } catch {
      setDevice({ ...DISCONNECTED, link: "error" });
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    handleRef.current?.cancel();
    setDevice(await transportRef.current.disconnect());
  }, []);

  const send = useCallback(() => {
    const payload = { ...config, deviceId: device.deviceId };
    if (!canSendToDevice(device.link, payload)) return;
    encodeCollarPayload(payload);
    setProgress(0);
    handleRef.current = transportRef.current.send(payload, ({ event, progress: value }) => {
      setProgress(value);
      setTransfer((current) => {
        const next = nextTransferState(current, event);
        if (next === "applied" && current !== "applied") {
          setLastSyncAt(new Date().toISOString());
          setSentVersion(payload.version);
        }
        return next;
      });
    });
  }, [config, device.deviceId, device.link]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  const value = useMemo<CollarContextValue>(() => ({
    pet,
    config,
    edit,
    device,
    connecting,
    connect,
    disconnect,
    transfer,
    progress,
    lastSyncAt,
    sentVersion,
    send,
    cancel,
    simulated: transportRef.current.kind === "simulated",
  }), [pet, config, edit, device, connecting, connect, disconnect, transfer, progress, lastSyncAt, sentVersion, send, cancel]);

  return <CollarContext.Provider value={value}>{children}</CollarContext.Provider>;
}

export function useCollar() {
  const value = useContext(CollarContext);
  if (!value) throw new Error("useCollar must be used inside CollarProvider");
  return value;
}
