export const PET_FIRST_ARCHIVE_FLAG = "NEXT_PUBLIC_PET_FIRST_ARCHIVE";
export const GUEST_PREVIEW_PET_ID = "00000000-0000-4000-8000-000000000001";

export const PET_PHOTO_MAX_COUNT = 5;
export const PET_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PET_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const PET_VIDEO_MAX_SECONDS = 30;
export const PET_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PET_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const LIFE_STATUSES = ["living", "memorial", "unspecified"] as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LifeStatus = (typeof LIFE_STATUSES)[number];
export type PetArchiveLocale = "ko" | "en";

export type PetCreateInput = {
  petName: string;
  lifeStatus: LifeStatus;
  species: string | null;
  birthday: string | null;
  adoptedOn: string | null;
  traits: string | null;
};

const FAVORITES_MARK = "\n◆ ";

export function splitPetNotes(traits: string | null | undefined): { personality: string | null; favorites: string | null } {
  if (!traits) return { personality: null, favorites: null };
  const index = traits.indexOf(FAVORITES_MARK);
  if (index === -1) return { personality: traits, favorites: null };
  return {
    personality: traits.slice(0, index).trim() || null,
    favorites: traits.slice(index + FAVORITES_MARK.length).trim() || null,
  };
}

export function joinPetNotes(personality: string | null | undefined, favorites: string | null | undefined): string | null {
  const left = personality?.trim() ?? "";
  const right = favorites?.trim() ?? "";
  if (!left && !right) return null;
  if (!right) return left;
  if (!left) return `◆ ${right}`;
  return `${left}${FAVORITES_MARK}${right}`;
}

export type PetSummary = {
  petId: string;
  petName: string;
  lifeStatus: LifeStatus;
  species: string | null;
  birthday?: string | null;
  createdAt: string;
};

export function isPetFirstArchiveEnabled(): boolean {
  return process.env[PET_FIRST_ARCHIVE_FLAG] === "1";
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isMissingRelationError(code: string | undefined | null): boolean {
  return code === "PGRST205" || code === "42P01";
}

export function decidePetAccess(
  sessionUserId: string | null,
  petOwnerId: string | null,
): "unauthenticated" | "not_found" | "ok" {
  if (!sessionUserId) return "unauthenticated";
  if (!petOwnerId || petOwnerId !== sessionUserId) return "not_found";
  return "ok";
}

export function parsePetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return null;
  if (/[\u0000-\u001F\u007F]/.test(name)) return null;
  return name;
}

export function parseLifeStatus(value: unknown): LifeStatus | null {
  if (value === undefined || value === null || value === "") return "unspecified";
  return LIFE_STATUSES.includes(value as LifeStatus) ? (value as LifeStatus) : null;
}

export function letterPathForLifeStatus(lifeStatus: LifeStatus, petId: string): string {
  const id = encodeURIComponent(petId);
  if (lifeStatus === "living") return `/living?petId=${id}`;
  if (lifeStatus === "memorial") return `/memorial?petId=${id}`;
  return `/choose?petId=${id}`;
}

function parseOptionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return null;
  if (text.length > max || /[\u0000-\u001F\u007F]/.test(text)) return undefined;
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

export function parsePetCreateInput(
  body: unknown,
): { ok: true; value: PetCreateInput } | { ok: false; error: "invalid_pet" } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_pet" };
  const record = body as Record<string, unknown>;
  const petName = parsePetName(record.petName ?? record.pet_name);
  const lifeStatus = parseLifeStatus(record.lifeStatus ?? record.life_status);
  const species = parseOptionalText(record.species, 40);
  const personality = parseOptionalText(record.traits, 400);
  const favorites = parseOptionalText(record.favorites, 200);
  const birthday = parseOptionalDate(record.birthday);
  const adoptedOn = parseOptionalDate(record.adoptedOn ?? record.adopted_on);
  if (!petName || !lifeStatus || species === undefined || personality === undefined || favorites === undefined || birthday === undefined || adoptedOn === undefined) {
    return { ok: false, error: "invalid_pet" };
  }
  return { ok: true, value: { petName, lifeStatus, species, birthday, adoptedOn, traits: joinPetNotes(personality, favorites) } };
}

export function petInsertRow(userId: string, input: PetCreateInput) {
  return {
    owner_user_id: userId,
    pet_name: input.petName,
    life_status: input.lifeStatus,
    species: input.species,
    birthday: input.birthday,
    adopted_on: input.adoptedOn,
    traits: input.traits,
  };
}

export function parsePetPatchInput(
  body: unknown,
): { ok: true; value: Partial<PetCreateInput> } | { ok: false; error: "invalid_pet" } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_pet" };
  const record = body as Record<string, unknown>;
  const value: Partial<PetCreateInput> = {};
  if ("petName" in record || "pet_name" in record) {
    const petName = parsePetName(record.petName ?? record.pet_name);
    if (!petName) return { ok: false, error: "invalid_pet" };
    value.petName = petName;
  }
  if ("lifeStatus" in record || "life_status" in record) {
    const lifeStatus = parseLifeStatus(record.lifeStatus ?? record.life_status);
    if (!lifeStatus) return { ok: false, error: "invalid_pet" };
    value.lifeStatus = lifeStatus;
  }
  if ("species" in record) {
    const species = parseOptionalText(record.species, 40);
    if (species === undefined) return { ok: false, error: "invalid_pet" };
    value.species = species;
  }
  if ("traits" in record || "favorites" in record) {
    const personality = "traits" in record ? parseOptionalText(record.traits, 400) : null;
    const favorites = "favorites" in record ? parseOptionalText(record.favorites, 200) : null;
    if (personality === undefined || favorites === undefined) return { ok: false, error: "invalid_pet" };
    value.traits = joinPetNotes(personality, favorites);
  }
  if ("birthday" in record) {
    const birthday = parseOptionalDate(record.birthday);
    if (birthday === undefined) return { ok: false, error: "invalid_pet" };
    value.birthday = birthday;
  }
  if ("adoptedOn" in record || "adopted_on" in record) {
    const adoptedOn = parseOptionalDate(record.adoptedOn ?? record.adopted_on);
    if (adoptedOn === undefined) return { ok: false, error: "invalid_pet" };
    value.adoptedOn = adoptedOn;
  }
  if (!Object.keys(value).length) return { ok: false, error: "invalid_pet" };
  return { ok: true, value };
}

export function petPatchRow(input: Partial<PetCreateInput>, updatedAt: string) {
  return {
    ...(input.petName ? { pet_name: input.petName } : {}),
    ...(input.lifeStatus ? { life_status: input.lifeStatus } : {}),
    ...("species" in input ? { species: input.species } : {}),
    ...("birthday" in input ? { birthday: input.birthday } : {}),
    ...("adoptedOn" in input ? { adopted_on: input.adoptedOn } : {}),
    ...("traits" in input ? { traits: input.traits } : {}),
    updated_at: updatedAt,
  };
}

export function validatePhotoFiles(files: { type: string; size: number }[]): "ok" | "invalid_photos" {
  if (!files.length || files.length > PET_PHOTO_MAX_COUNT) return "invalid_photos";
  if (files.some((file) => !PET_PHOTO_TYPES.has(file.type) || file.size <= 0 || file.size > PET_PHOTO_MAX_BYTES)) {
    return "invalid_photos";
  }
  return "ok";
}

export function parseCaptionAndDate(
  caption: string,
  memoryDate: string,
): { ok: true; caption: string | null; happenedOn: string | null } | { ok: false; error: "invalid_metadata" } {
  const trimmed = caption.trim();
  if (trimmed.length > 500) return { ok: false, error: "invalid_metadata" };
  const happenedOn = parseOptionalDate(memoryDate);
  if (happenedOn === undefined) return { ok: false, error: "invalid_metadata" };
  return { ok: true, caption: trimmed || null, happenedOn };
}

export function validateVideoFile(
  file: { type: string; size: number },
  durationSeconds: number,
  caption: string,
  memoryDate: string,
): "ok" | "invalid_video" {
  if (!PET_VIDEO_TYPES.has(file.type) || file.size <= 0 || file.size > PET_VIDEO_MAX_BYTES) return "invalid_video";
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > PET_VIDEO_MAX_SECONDS) return "invalid_video";
  if (parseCaptionAndDate(caption, memoryDate).ok === false) return "invalid_video";
  return "ok";
}

export function parseTextMemory(
  body: unknown,
): { ok: true; value: { story: string; title: string | null; happenedOn: string | null } } | { ok: false; error: "invalid_memory" } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_memory" };
  const record = body as Record<string, unknown>;
  if (typeof record.story !== "string") return { ok: false, error: "invalid_memory" };
  const story = record.story.trim();
  if (story.length < 1 || story.length > 2000) return { ok: false, error: "invalid_memory" };
  const title = parseOptionalText(record.title, 80);
  const happenedOn = parseOptionalDate(record.happenedOn ?? record.happened_on ?? record.memoryDate);
  if (title === undefined || happenedOn === undefined) return { ok: false, error: "invalid_memory" };
  return { ok: true, value: { story, title, happenedOn } };
}

export function photoExtension(contentType: string): string | null {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return null;
}

export function videoExtension(contentType: string): string | null {
  if (contentType === "video/mp4") return "mp4";
  if (contentType === "video/webm") return "webm";
  if (contentType === "video/quicktime") return "mov";
  return null;
}

export function petFirstStoragePath(input: {
  userId: string;
  petId: string;
  entryId: string;
  assetId: string;
  extension: string;
}): string {
  return `${input.userId}/${input.petId}/pet-first/${input.entryId}/${input.assetId}.${input.extension}`;
}

export function isOwnerStoragePath(path: string, userId: string): boolean {
  const [owner, ...rest] = path.split("/");
  return owner === userId && rest.length >= 4 && !path.split("/").some((part) => part === "" || part === "." || part === "..");
}

export function describeMemoryDate(happenedOn: string | null): "owner-entered" | "save-time-only" {
  return happenedOn ? "owner-entered" : "save-time-only";
}

export { petFirstCopy, type PetFirstCopy } from "./storybook-copy.ts";

export type PetTimelineDate = { happenedOn: string | null; createdAt: string };

export function timelineDay(entry: PetTimelineDate): string {
  return entry.happenedOn ?? entry.createdAt.slice(0, 10);
}

export function timelineMonthKey(entry: PetTimelineDate): string {
  return timelineDay(entry).slice(0, 7);
}

export function isSameDayLastYear(entry: PetTimelineDate, today: string): boolean {
  if (!entry.happenedOn) return false;
  const [year, month, day] = today.split("-").map(Number);
  return entry.happenedOn === `${String(year - 1).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysTogether(since: string | null, today: string): number | null {
  if (!since) return null;
  const start = Date.parse(`${since}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function seoulToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const MONTHLY_CARD_MIN_ENTRIES = 3;

export function monthlyCardReady(entries: PetTimelineDate[], monthKey: string): boolean {
  return entries.filter((entry) => timelineMonthKey(entry) === monthKey).length >= MONTHLY_CARD_MIN_ENTRIES;
}
