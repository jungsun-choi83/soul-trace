import {
  letterPathForLifeStatus,
  type LifeStatus,
  timelineDay,
  timelineMonthKey,
  type PetTimelineDate,
} from "./pet-first-archive.ts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MemoryKind = "photo" | "video" | "text";
export type MemoryOrigin = "pet_first" | "legacy";

export type MemoryAsset = {
  assetId: string;
  url: string;
  contentType: string;
  order: number;
};

export type MemoryLibraryItem = PetTimelineDate & {
  entryId: string;
  kind: MemoryKind;
  title: string | null;
  story: string | null;
  place: string | null;
  favorite: boolean;
  origin: MemoryOrigin;
  deletable: boolean;
  assets: MemoryAsset[];
};

export type DayGroup<T extends PetTimelineDate = MemoryLibraryItem> = {
  key: string;
  items: T[];
};

export type MonthGroup<T extends PetTimelineDate = MemoryLibraryItem> = {
  key: string;
  days: DayGroup<T>[];
};

export const MOOD_JOURNAL_TITLE = "마음 기록";
export const BEAM_PLACES = ["home", "park", "travel", "other"] as const;
export type BeamPlace = (typeof BEAM_PLACES)[number];

export function isBeamPlace(value: unknown): value is BeamPlace {
  return typeof value === "string" && (BEAM_PLACES as readonly string[]).includes(value);
}

export function memoriesHref(petId?: string | null): string {
  return petId ? `/memories?pet=${encodeURIComponent(petId)}` : "/memories";
}

export function memorialSpaceHref(petId: string): string {
  return `/memorial-space?pet=${encodeURIComponent(petId)}`;
}

export function moodJournalHref(petId: string): string {
  return `/mood-journal?pet=${encodeURIComponent(petId)}`;
}

export function deviceHref(petId: string): string {
  return `/my/device?pet=${encodeURIComponent(petId)}`;
}

export function polaroidHrefFromArchive(petId: string): string {
  return `/polaroid?petId=${encodeURIComponent(petId)}`;
}

export function beamSceneHref(petId: string, entryId?: string, assetId?: string): string {
  const query = new URLSearchParams({ pet: petId });
  if (entryId) query.set("entry", entryId);
  if (assetId) query.set("asset", assetId);
  return `/beam-scene?${query.toString()}`;
}

export function letterHrefForPet(lifeStatus: LifeStatus, petId: string): string {
  return letterPathForLifeStatus(lifeStatus, petId);
}

export function canOpenMemorialSpace(lifeStatus: LifeStatus): boolean {
  return lifeStatus === "memorial";
}

export function canOpenCollar(lifeStatus: LifeStatus): boolean {
  return lifeStatus !== "memorial";
}

export function decideMemorialSpaceAccess(
  sessionUserId: string | null,
  petOwnerId: string | null,
  lifeStatus: LifeStatus | null,
): "unauthenticated" | "not_found" | "not_memorial" | "ok" {
  if (!sessionUserId) return "unauthenticated";
  if (!petOwnerId || petOwnerId !== sessionUserId) return "not_found";
  if (lifeStatus !== "memorial") return "not_memorial";
  return "ok";
}

export function decideDeviceAccess(
  sessionUserId: string | null,
  petOwnerId: string | null,
  lifeStatus: LifeStatus | null,
): "unauthenticated" | "not_found" | "not_living" | "ok" {
  if (!sessionUserId) return "unauthenticated";
  if (!petOwnerId || petOwnerId !== sessionUserId) return "not_found";
  if (lifeStatus === "memorial") return "not_living";
  return "ok";
}

export function parseOptionalPlace(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  if (text.length > 80 || /[\u0000-\u001F\u007F]/.test(text)) return undefined;
  return text;
}

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value;
}

function parseOptionalTitle(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  if (text.length > 80 || /[\u0000-\u001F\u007F]/.test(text)) return undefined;
  return text;
}

export type MemoryPatch = {
  title?: string | null;
  place?: string | null;
  happenedOn?: string | null;
  favorite?: boolean;
};

export function parseMemoryPatch(
  body: unknown,
): { ok: true; value: MemoryPatch } | { ok: false; error: "invalid_memory" } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_memory" };
  const record = body as Record<string, unknown>;
  const value: MemoryPatch = {};
  if ("title" in record) {
    const title = parseOptionalTitle(record.title);
    if (title === undefined) return { ok: false, error: "invalid_memory" };
    value.title = title;
  }
  if ("place" in record) {
    const place = parseOptionalPlace(record.place);
    if (place === undefined) return { ok: false, error: "invalid_memory" };
    value.place = place;
  }
  if ("happenedOn" in record || "happened_on" in record || "memoryDate" in record) {
    const happenedOn = parseOptionalDate(record.happenedOn ?? record.happened_on ?? record.memoryDate);
    if (happenedOn === undefined) return { ok: false, error: "invalid_memory" };
    value.happenedOn = happenedOn;
  }
  if ("favorite" in record) {
    if (typeof record.favorite !== "boolean") return { ok: false, error: "invalid_memory" };
    value.favorite = record.favorite;
  }
  if (!Object.keys(value).length) return { ok: false, error: "invalid_memory" };
  return { ok: true, value };
}

export function memoryPatchRow(input: MemoryPatch, updatedAt: string) {
  return {
    ...(Object.prototype.hasOwnProperty.call(input, "title") ? { title: input.title ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "place") ? { place: input.place ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "happenedOn") ? { happened_on: input.happenedOn ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "favorite") ? { favorite: Boolean(input.favorite) } : {}),
    updated_at: updatedAt,
  };
}

export function sortLibraryItems<T extends PetTimelineDate & { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => timelineDay(b).localeCompare(timelineDay(a)) || b.createdAt.localeCompare(a.createdAt));
}

export function groupLibraryByMonthAndDay<T extends PetTimelineDate & { createdAt: string }>(items: T[]): MonthGroup<T>[] {
  const months: MonthGroup<T>[] = [];
  for (const item of sortLibraryItems(items)) {
    const monthKey = timelineMonthKey(item);
    const dayKey = timelineDay(item);
    let month = months[months.length - 1];
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, days: [] };
      months.push(month);
    }
    const lastDay = month.days[month.days.length - 1];
    if (lastDay?.key === dayKey) lastDay.items.push(item);
    else month.days.push({ key: dayKey, items: [item] });
  }
  return months;
}

export function isMoodJournalItem(item: Pick<MemoryLibraryItem, "kind" | "title">): boolean {
  return item.kind === "text" && item.title === MOOD_JOURNAL_TITLE;
}

export function parseMoodJournalBody(
  body: unknown,
): { ok: true; value: { story: string } } | { ok: false; error: "invalid_memory" } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_memory" };
  const record = body as Record<string, unknown>;
  if (typeof record.story !== "string" && typeof record.body !== "string") return { ok: false, error: "invalid_memory" };
  const story = String(record.story ?? record.body).trim();
  if (story.length < 1 || story.length > 2000) return { ok: false, error: "invalid_memory" };
  return { ok: true, value: { story } };
}

export type BeamSceneDraft = {
  petId: string;
  entryId: string | null;
  assetId: string | null;
  title: string;
  happenedOn: string | null;
  place: BeamPlace;
  originalUrl: string | null;
  derivativeUrl: string | null;
};

export function createBeamSceneDraft(input: Partial<BeamSceneDraft> & { petId: string }): BeamSceneDraft {
  return {
    petId: input.petId,
    entryId: input.entryId ?? null,
    assetId: input.assetId ?? null,
    title: (input.title ?? "").trim().slice(0, 80),
    happenedOn: input.happenedOn ?? null,
    place: isBeamPlace(input.place) ? input.place : "home",
    originalUrl: input.originalUrl ?? null,
    derivativeUrl: input.derivativeUrl ?? null,
  };
}

export function beamDualDisplay(scene: BeamSceneDraft) {
  return {
    left: { role: "background" as const, place: scene.place },
    right: { role: "foreground" as const, source: scene.derivativeUrl ? "approved_motion" : "original_photo" },
    hardwarePlayback: false,
    transferEnabled: false,
    originalPreserved: true,
  };
}

export function splitBeamAssets(originalUrl: string | null, derivativeUrl: string | null) {
  return {
    original: originalUrl,
    derivative: derivativeUrl && derivativeUrl !== originalUrl ? derivativeUrl : null,
  };
}

export const NATIVE_PHOTO_SYNC = {
  web: "manual_picker_only",
  native: "opt_in_camera_roll_after_permission",
  grouping: "capture_date_then_month_and_day",
  neverGuessCaptureDateOnWeb: true,
} as const;
