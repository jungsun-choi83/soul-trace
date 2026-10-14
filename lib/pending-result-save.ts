export type PendingResultSave = {
  kind: "letter" | "visual-memory";
  resultId: string;
  proof: string;
} | {
  kind: "seasonal-polaroid";
  resultId: string;
  proof: string;
  jobId: string;
  capability: string;
  action: "save" | "download";
};

const STORAGE_KEY = "soul-trace-pending-save";

export function writePendingResultSave(action: PendingResultSave): void {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(action));
}

export function readPendingResultSave(): PendingResultSave | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PendingResultSave> | null;
    if (!value || (value.kind !== "letter" && value.kind !== "visual-memory" && value.kind !== "seasonal-polaroid")) return null;
    if (typeof value.resultId !== "string" || typeof value.proof !== "string") return null;
    if (value.kind === "seasonal-polaroid") {
      if (typeof value.jobId !== "string" || typeof value.capability !== "string") return null;
      if (value.action !== "save" && value.action !== "download") return null;
      return {
        kind: value.kind,
        resultId: value.resultId,
        proof: value.proof,
        jobId: value.jobId,
        capability: value.capability,
        action: value.action,
      };
    }
    return { kind: value.kind, resultId: value.resultId, proof: value.proof };
  } catch {
    return null;
  }
}

export function clearPendingResultSave(): void {
  window.sessionStorage.removeItem(STORAGE_KEY);
}
