export type PendingResultSave = {
  kind: "letter" | "visual-memory";
  resultId: string;
  proof: string;
};

const STORAGE_KEY = "soul-trace-pending-save";

export function writePendingResultSave(action: PendingResultSave): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

export function readPendingResultSave(): PendingResultSave | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PendingResultSave> | null;
    if (!value || (value.kind !== "letter" && value.kind !== "visual-memory")) return null;
    if (typeof value.resultId !== "string" || typeof value.proof !== "string") return null;
    return { kind: value.kind, resultId: value.resultId, proof: value.proof };
  } catch {
    return null;
  }
}

export function clearPendingResultSave(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
