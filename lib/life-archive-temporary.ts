import type { Locale } from "@/lib/i18n";

export const TEMPORARY_LIFE_ARCHIVE_KEY = "soul-trace-temporary-life-archive";

export type TemporaryArchiveMemory = {
  memoryId: string;
  title: string | null;
  story: string;
  memoryDate: string | null;
  createdAt: string;
};

export type TemporaryLifeArchive = {
  archiveKey: string;
  petName: string;
  letter: string;
  generationLocale: Locale;
  createdAt: string;
  soulTraceMemoryCount: number;
  archiveMemoryCount: number;
  memories: TemporaryArchiveMemory[];
};

export function saveTemporaryLifeArchive(archive: TemporaryLifeArchive): void {
  window.sessionStorage.setItem(TEMPORARY_LIFE_ARCHIVE_KEY, JSON.stringify(archive));
}

export function loadTemporaryLifeArchive(): TemporaryLifeArchive | null {
  try {
    const raw = window.sessionStorage.getItem(TEMPORARY_LIFE_ARCHIVE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TemporaryLifeArchive>;
    if (
      typeof value.petName !== "string" ||
      typeof value.letter !== "string" ||
      (value.generationLocale !== "ko" && value.generationLocale !== "en") ||
      typeof value.createdAt !== "string" ||
      typeof value.soulTraceMemoryCount !== "number" ||
      !Array.isArray(value.memories)
    ) {
      return null;
    }
    const archive = {
      ...value,
      archiveKey: typeof value.archiveKey === "string" && value.archiveKey
        ? value.archiveKey
        : crypto.randomUUID(),
      archiveMemoryCount: value.memories.length,
    } as TemporaryLifeArchive;
    if (!value.archiveKey) saveTemporaryLifeArchive(archive);
    return archive;
  } catch {
    return null;
  }
}
