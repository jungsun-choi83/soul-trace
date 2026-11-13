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

export type PrivateMemoryAsset = {
  asset_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  asset_order: number;
};

export async function signAvailableMemoryAssets(
  assets: readonly PrivateMemoryAsset[],
  createSignedUrl: (asset: PrivateMemoryAsset) => Promise<{ url: string | null; error?: unknown }>,
): Promise<{ assets: MemoryAsset[]; failedCount: number }> {
  const results = await Promise.all(assets.map(async (asset) => {
    try {
      const signed = await createSignedUrl(asset);
      if (signed.error || !signed.url) return null;
      return {
        assetId: asset.asset_id,
        url: signed.url,
        contentType: asset.content_type || "application/octet-stream",
        order: asset.asset_order,
      };
    } catch {
      return null;
    }
  }));
  const available = results.filter((asset): asset is MemoryAsset => asset !== null);
  return { assets: available, failedCount: results.length - available.length };
}

export async function readOptionalMemoryRows<T>(
  read: () => PromiseLike<{ data: T[] | null; error: { code?: string | null } | null }>,
): Promise<{ rows: T[]; errorCode: string | null }> {
  try {
    const result = await read();
    if (result.error) return { rows: [], errorCode: result.error.code || "read_failed" };
    return { rows: result.data ?? [], errorCode: null };
  } catch {
    return { rows: [], errorCode: "read_failed" };
  }
}

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

export type YearMonthFolder<T extends PetTimelineDate = MemoryLibraryItem> = MonthGroup<T> & {
  year: string;
  count: number;
};

export type YearFolder<T extends PetTimelineDate = MemoryLibraryItem> = {
  year: string;
  months: YearMonthFolder<T>[];
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

/** Month folders opened from "이번 달의 추억". Photos are grouped by capture month. */
export function memoriesMonthHref(petId?: string | null, month?: string | null): string {
  const query = new URLSearchParams();
  if (petId) query.set("pet", petId);
  query.set("view", "months");
  if (month && /^\d{4}-\d{2}$/.test(month)) query.set("month", month);
  const value = query.toString();
  return value ? `/memories?${value}` : "/memories";
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

export function polaroidHrefFromArchive(petId: string, entryId?: string, assetId?: string): string {
  const query = new URLSearchParams({ petId });
  if (entryId && assetId) {
    query.set("memoryEntryId", entryId);
    query.set("memoryAssetId", assetId);
  }
  return `/polaroid?${query.toString()}`;
}

export type MemoryPolaroidPhotoSource = {
  assetId: string;
  entryId: string;
  ownerUserId: string;
  petId: string;
  storageBucket: string;
  storagePath: string;
  contentType: string;
};

export function authorizeMemoryPolaroidPhoto(
  source: MemoryPolaroidPhotoSource | null | undefined,
  expected: { assetId: string; entryId: string; ownerUserId: string; petId: string },
): MemoryPolaroidPhotoSource | null {
  if (!source) return null;
  if (
    source.assetId !== expected.assetId
    || source.entryId !== expected.entryId
    || source.ownerUserId !== expected.ownerUserId
    || source.petId !== expected.petId
    || source.storageBucket !== "life-archive-photos"
    || !source.storagePath
    || !["image/jpeg", "image/png", "image/webp"].includes(source.contentType)
  ) return null;
  return source;
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
  story?: string | null;
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
  if ("story" in record) {
    if (record.story === null || record.story === "") {
      value.story = null;
    } else if (typeof record.story !== "string") {
      return { ok: false, error: "invalid_memory" };
    } else {
      const story = record.story.trim();
      if (story.length > 2000) return { ok: false, error: "invalid_memory" };
      value.story = story || null;
    }
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
    ...(Object.prototype.hasOwnProperty.call(input, "story") ? { story: input.story ?? null } : {}),
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

export function groupLibraryIntoYearFolders<T extends PetTimelineDate & { createdAt: string }>(items: T[]): YearFolder<T>[] {
  const years: YearFolder<T>[] = [];
  for (const month of groupLibraryByMonthAndDay(items)) {
    const year = month.key.slice(0, 4);
    const folder: YearMonthFolder<T> = {
      ...month,
      year,
      count: month.days.reduce((count, day) => count + day.items.length, 0),
    };
    let yearGroup = years[years.length - 1];
    if (!yearGroup || yearGroup.year !== year) {
      yearGroup = { year, months: [] };
      years.push(yearGroup);
    }
    yearGroup.months.push(folder);
  }
  return years;
}

export function flattenYearFoldersNewestFirst<T extends PetTimelineDate>(years: readonly YearFolder<T>[]): YearMonthFolder<T>[] {
  return years.flatMap((year) => year.months).sort((a, b) => b.key.localeCompare(a.key));
}

export function monthFolderCoverUrl(folder: YearMonthFolder<MemoryLibraryItem>): string | null {
  for (const day of folder.days) {
    for (const item of day.items) {
      const photo = item.assets.find((asset) => asset.contentType.startsWith("image/"));
      if (photo) return photo.url;
    }
  }
  return null;
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
