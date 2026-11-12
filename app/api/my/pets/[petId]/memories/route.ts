import { isMissingRelationError, isUuid, parseTextMemory } from "@/lib/pet-first-archive";
import { rememberMissingTimeline, skipPetTimelineQuery } from "@/lib/pet-first-archive-data";
import {
  memoryPatchRow,
  parseMemoryPatch,
  readOptionalMemoryRows,
  signAvailableMemoryAssets,
} from "@/lib/memory-library";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";
import { persistedPolaroidOccasionId } from "@/lib/seasonal-polaroid-occasion";

type AssetRow = {
  asset_id: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string;
  asset_order: number;
};

type SignedAsset = {
  assetId: string;
  url: string;
  contentType: string;
  order: number;
};

type EntryRow = {
  entry_id: string;
  kind: "photo" | "video" | "text";
  title: string | null;
  story: string | null;
  place?: string | null;
  favorite?: boolean | null;
  happened_on: string | null;
  created_at: string;
  origin: string;
  pet_timeline_assets: AssetRow[] | null;
};

const ENTRY_SELECT_FULL =
  "entry_id, kind, title, story, place, favorite, happened_on, created_at, origin, pet_timeline_assets(asset_id, storage_bucket, storage_path, content_type, asset_order)";
const ENTRY_SELECT_BASE =
  "entry_id, kind, title, story, happened_on, created_at, origin, pet_timeline_assets(asset_id, storage_bucket, storage_path, content_type, asset_order)";

async function signedAssets(
  supabase: {
    storage: {
      from: (bucket: string) => {
        createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl: string } | null; error?: unknown }>;
      };
    };
  },
  assets: AssetRow[],
): Promise<{ assets: SignedAsset[]; failedCount: number }> {
  return signAvailableMemoryAssets(assets, async (asset) => {
    const { data, error } = await supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 3600);
    return { url: data?.signedUrl ?? null, error };
  });
}

function logSigningFailures(failedCount: number) {
  if (failedCount > 0) {
    console.error("[pet-first] memory asset signing partially failed", { failedCount });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;

  const full = skipPetTimelineQuery()
    ? { data: [] as EntryRow[], error: null }
    : await access.supabase
      .from("pet_timeline_entries")
      .select(ENTRY_SELECT_FULL)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false });
  const entriesResult = !full.error || full.error.code !== "42703"
    ? full
    : await access.supabase
      .from("pet_timeline_entries")
      .select(ENTRY_SELECT_BASE)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false });
  rememberMissingTimeline(entriesResult.error?.code);
  if (entriesResult.error && !isMissingRelationError(entriesResult.error.code)) {
    console.error("[pet-first] timeline failed", { code: entriesResult.error.code });
    return privateJson({ error: "unavailable" }, 503);
  }

  const entries = [];
  let failedAssetSigningCount = 0;
  for (const entry of (entriesResult.data ?? []) as EntryRow[]) {
    const signed = await signedAssets(access.supabase, [...(entry.pet_timeline_assets ?? [])].sort((a, b) => a.asset_order - b.asset_order));
    failedAssetSigningCount += signed.failedCount;
    entries.push({
      entryId: entry.entry_id,
      kind: entry.kind,
      title: entry.title,
      story: entry.story,
      place: entry.place ?? null,
      favorite: Boolean(entry.favorite),
      happenedOn: entry.happened_on,
      createdAt: entry.created_at,
      origin: "pet_first" as const,
      deletable: true,
      assets: signed.assets,
    });
  }

  const [legacyPhotos, legacyVideos, legacyTexts, savedLetters, polaroidsRead] = await Promise.all([
    access.supabase
      .from("life_archive_photo_moments")
      .select("moment_id, caption, memory_date, created_at, life_archive_photos(photo_id, storage_path, photo_order, content_type)")
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false }),
    access.supabase
      .from("life_archive_videos")
      .select("video_id, storage_path, caption, memory_date, created_at, content_type")
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false }),
    access.supabase
      .from("life_archive_memories")
      .select("memory_id, title, story, memory_date, created_at")
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false }),
    readOptionalMemoryRows(() => access.supabase
      .from("soul_trace_submissions")
      .select("submission_id, letter_id, letter_title, generated_letter, generation_locale, created_at")
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false })),
    readOptionalMemoryRows(() => access.supabase
      .from("seasonal_polaroid_results")
      .select("result_id, pet_id, pet_name, theme_id, generation_metadata, memo_line_1, memo_line_2, memo_line_3, memo_line_4, created_at")
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .order("created_at", { ascending: false })),
  ]);

  const polaroidSchemaMissing = polaroidsRead.errorCode === "42703"
    || polaroidsRead.errorCode === "PGRST204"
    || isMissingRelationError(polaroidsRead.errorCode);
  if (savedLetters.errorCode) {
    console.error("[pet-first] optional Letter read failed", { code: savedLetters.errorCode });
  }
  if (polaroidsRead.errorCode && !polaroidSchemaMissing) {
    console.error("[pet-first] optional Polaroid read failed", { code: polaroidsRead.errorCode });
  }
  const legacyReadError = legacyPhotos.error ?? legacyVideos.error ?? legacyTexts.error;
  if (legacyReadError) {
    logSigningFailures(failedAssetSigningCount);
    console.error("[pet-first] historical memory read failed", { code: legacyReadError.code });
    return privateJson({ error: "unavailable" }, 503);
  }

  const legacy = [];
  for (const moment of legacyPhotos.data ?? []) {
    const photos = [...(moment.life_archive_photos ?? [])].sort((a, b) => a.photo_order - b.photo_order);
    const signed = await signedAssets(access.supabase, photos.map((photo) => ({
      asset_id: photo.photo_id,
      storage_bucket: "life-archive-photos",
      storage_path: photo.storage_path,
      content_type: photo.content_type,
      asset_order: photo.photo_order,
    })));
    failedAssetSigningCount += signed.failedCount;
    legacy.push({
      entryId: moment.moment_id,
      kind: "photo" as const,
      title: moment.caption,
      story: null,
      place: null,
      favorite: false,
      happenedOn: moment.memory_date,
      createdAt: moment.created_at,
      origin: "legacy" as const,
      deletable: false,
      assets: signed.assets,
    });
  }
  for (const video of legacyVideos.data ?? []) {
    const signed = await signedAssets(access.supabase, [{
      asset_id: video.video_id,
      storage_bucket: "life-archive-videos",
      storage_path: video.storage_path,
      content_type: video.content_type,
      asset_order: 0,
    }]);
    failedAssetSigningCount += signed.failedCount;
    legacy.push({
      entryId: video.video_id,
      kind: "video" as const,
      title: video.caption,
      story: null,
      place: null,
      favorite: false,
      happenedOn: video.memory_date,
      createdAt: video.created_at,
      origin: "legacy" as const,
      deletable: false,
      assets: signed.assets,
    });
  }
  for (const memory of legacyTexts.data ?? []) {
    legacy.push({
      entryId: memory.memory_id,
      kind: "text" as const,
      title: memory.title,
      story: memory.story,
      place: null,
      favorite: false,
      happenedOn: memory.memory_date,
      createdAt: memory.created_at,
      origin: "legacy" as const,
      deletable: false,
      assets: [],
    });
  }
  logSigningFailures(failedAssetSigningCount);
  const timeline = [...entries, ...legacy].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const letters = savedLetters.rows.map((letter) => ({
    submissionId: letter.submission_id,
    letterId: letter.letter_id,
    title: letter.letter_title,
    content: letter.generated_letter,
    locale: letter.generation_locale,
    createdAt: letter.created_at,
  }));
  const polaroids = polaroidsSchemaRows(polaroidsRead.rows, polaroidSchemaMissing).map((result) => ({
    resultId: result.result_id,
    petName: result.pet_name,
    themeId: result.theme_id,
    occasionId: persistedPolaroidOccasionId(result.generation_metadata, result.theme_id),
    memo: [result.memo_line_1, result.memo_line_2, result.memo_line_3, result.memo_line_4].join("\n"),
    createdAt: result.created_at,
    imageUrl: `/api/account-result/seasonal-polaroid?resultId=${encodeURIComponent(result.result_id)}`,
  }));
  return privateJson({ timeline, letters, polaroids }, 200);
}

function polaroidsSchemaRows<T>(rows: T[] | null, schemaMissing: boolean): T[] {
  return schemaMissing ? [] : rows ?? [];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const parsed = parseTextMemory(await request.json().catch(() => null));
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);
  const { data, error } = await access.supabase
    .from("pet_timeline_entries")
    .insert({
      owner_user_id: access.user.id,
      pet_id: access.pet.pet_id,
      kind: "text",
      title: parsed.value.title,
      story: parsed.value.story,
      happened_on: parsed.value.happenedOn,
      visibility: "private",
      origin: "pet_first_archive",
    })
    .select("entry_id")
    .single();
  if (error || !data) {
    console.error("[pet-first] text entry failed", { code: error?.code });
    return privateJson({ error: "save_failed" }, 500);
  }
  return privateJson({ entryId: data.entry_id }, 201);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!isUuid(entryId)) return privateJson({ error: "not_found" }, 404);
  const parsed = parseMemoryPatch(body);
  if (!parsed.ok) return privateJson({ error: parsed.error }, 400);
  if (Object.prototype.hasOwnProperty.call(parsed.value, "story") && parsed.value.story === null) {
    const { data: current, error } = await access.supabase
      .from("pet_timeline_entries")
      .select("kind")
      .eq("entry_id", entryId)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .maybeSingle();
    if (error) {
      console.error("[pet-first] memory kind lookup failed", { code: error.code });
      return privateJson({ error: "save_failed" }, 500);
    }
    if (!current) return privateJson({ error: "not_found" }, 404);
    if (current.kind === "text") return privateJson({ error: "invalid_memory" }, 400);
  }
  const row = memoryPatchRow(parsed.value, new Date().toISOString());
  const full = await access.supabase
    .from("pet_timeline_entries")
    .update(row)
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .select("entry_id")
    .maybeSingle();
  const updated = !full.error || full.error.code !== "42703"
    ? full
    : await access.supabase
      .from("pet_timeline_entries")
      .update({
        ...(Object.prototype.hasOwnProperty.call(parsed.value, "title") ? { title: parsed.value.title ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.value, "story") ? { story: parsed.value.story ?? null } : {}),
        ...(Object.prototype.hasOwnProperty.call(parsed.value, "happenedOn") ? { happened_on: parsed.value.happenedOn ?? null } : {}),
        updated_at: row.updated_at,
      })
      .eq("entry_id", entryId)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .select("entry_id")
      .maybeSingle();
  if (updated.error) {
    console.error("[pet-first] memory patch failed", { code: updated.error.code });
    return privateJson({ error: "save_failed" }, 500);
  }
  if (!updated.data) return privateJson({ error: "not_found" }, 404);
  return privateJson({ entryId: updated.data.entry_id, ...parsed.value }, 200);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as { entryId?: unknown } | null;
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  if (!isUuid(entryId)) return privateJson({ error: "not_found" }, 404);
  const { data: assets, error: assetError } = await access.supabase
    .from("pet_timeline_assets")
    .select("storage_bucket, storage_path")
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id);
  if (assetError) {
    console.error("[pet-first] asset lookup failed", { code: assetError.code });
    return privateJson({ error: "delete_failed" }, 500);
  }
  const { data: deleted, error } = await access.supabase
    .from("pet_timeline_entries")
    .delete()
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .select("entry_id");
  if (error) {
    console.error("[pet-first] entry delete failed", { code: error.code });
    return privateJson({ error: "delete_failed" }, 500);
  }
  if (!deleted?.length) return privateJson({ error: "not_found" }, 404);
  const photoPaths = (assets ?? []).filter((asset) => asset.storage_bucket === "life-archive-photos").map((asset) => asset.storage_path);
  const videoPaths = (assets ?? []).filter((asset) => asset.storage_bucket === "life-archive-videos").map((asset) => asset.storage_path);
  if (photoPaths.length) await access.supabase.storage.from("life-archive-photos").remove(photoPaths);
  if (videoPaths.length) await access.supabase.storage.from("life-archive-videos").remove(videoPaths);
  return privateJson({ status: "deleted" }, 200);
}
