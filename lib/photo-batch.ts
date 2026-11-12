import { parseCaptionAndDate } from "./pet-first-archive.ts";

export type DatedPhoto<TFile> = { file: TFile; happenedOn: string | null };

/** A single optional date overrides EXIF dates; otherwise retain per-photo capture dates. */
export function resolvePhotoBatchDates<T>(
  photos: readonly T[],
  detectedDates: readonly (string | null)[],
  optionalDate: string,
): string[] {
  return photos.map((_, index) => optionalDate || detectedDates[index] || "");
}

export function parsePhotoBatchDates(
  caption: string,
  submittedDates: unknown[],
  legacyDate: string,
  fileCount: number,
): { ok: true; caption: string | null; happenedOn: (string | null)[] } | { ok: false } {
  const dates = submittedDates.length
    ? submittedDates.map((value) => typeof value === "string" ? value : "invalid")
    : Array.from({ length: fileCount }, () => legacyDate);
  if (dates.length !== fileCount) return { ok: false };
  const parsed = dates.map((date) => parseCaptionAndDate(caption, date));
  if (parsed.some((value) => !value.ok)) return { ok: false };
  const first = parsed[0];
  if (!first?.ok) return { ok: false };
  return { ok: true, caption: first.caption, happenedOn: parsed.map((value) => value.ok ? value.happenedOn : null) };
}

export async function persistDatedPhotoBatch<TFile, TEntry extends { entryId: string }>(
  photos: DatedPhoto<TFile>[],
  operations: {
    createEntry(photo: DatedPhoto<TFile>, index: number): Promise<TEntry>;
    uploadAndLink(entry: TEntry, photo: DatedPhoto<TFile>, index: number, onUploaded: (path: string) => void): Promise<void>;
    rollback(entryIds: string[], storagePaths: string[]): Promise<void>;
  },
): Promise<{ ok: true; entryIds: string[] } | { ok: false; error: unknown; stage: "entry" | "upload" | "rollback" }> {
  const entryIds: string[] = [];
  const storagePaths: string[] = [];
  let stage: "entry" | "upload" = "entry";
  try {
    for (const [index, photo] of photos.entries()) {
      stage = "entry";
      const entry = await operations.createEntry(photo, index);
      entryIds.push(entry.entryId);
      stage = "upload";
      await operations.uploadAndLink(entry, photo, index, (path) => storagePaths.push(path));
    }
    return { ok: true, entryIds };
  } catch (error) {
    try {
      await operations.rollback(entryIds, storagePaths);
    } catch (rollbackError) {
      return { ok: false, error: rollbackError, stage: "rollback" };
    }
    return { ok: false, error, stage };
  }
}
