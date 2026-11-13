import { isMissingRelationError, isUuid } from "@/lib/pet-first-archive";
import { authorizeMemoryPolaroidPhoto } from "@/lib/memory-library";
import { requireOwnedPet } from "@/lib/pet-first-archive-server";
import { SEASONAL_POLAROID_PHOTO_MAX_BYTES } from "@/lib/seasonal-polaroid-photo";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(error: string, status: number) {
  return Response.json({ error }, { status, headers: PRIVATE_HEADERS });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ petId: string; entryId: string; assetId: string }> },
) {
  const { petId, entryId, assetId } = await params;
  if (!isUuid(petId) || !isUuid(entryId) || !isUuid(assetId)) return errorResponse("not_found", 404);

  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;

  const { data: entry, error: entryError } = await access.supabase
    .from("pet_timeline_entries")
    .select("entry_id, kind")
    .eq("entry_id", entryId)
    .eq("owner_user_id", access.user.id)
    .eq("pet_id", access.pet.pet_id)
    .maybeSingle();
  if (entryError && !isMissingRelationError(entryError.code)) {
    console.error("[pet-first] Polaroid source entry lookup failed", { code: entryError.code });
    return errorResponse("unavailable", 503);
  }

  let source = null;
  if (!entryError && entry) {
    if (entry.kind !== "photo") return errorResponse("not_found", 404);
    const { data: asset, error: assetError } = await access.supabase
      .from("pet_timeline_assets")
      .select("asset_id, entry_id, owner_user_id, pet_id, storage_bucket, storage_path, content_type")
      .eq("asset_id", assetId)
      .eq("entry_id", entryId)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .maybeSingle();
    if (assetError) {
      console.error("[pet-first] Polaroid source asset lookup failed", { code: assetError.code });
      return errorResponse("unavailable", 503);
    }
    source = authorizeMemoryPolaroidPhoto(asset ? {
      assetId: asset.asset_id,
      entryId: asset.entry_id,
      ownerUserId: asset.owner_user_id,
      petId: asset.pet_id,
      storageBucket: asset.storage_bucket,
      storagePath: asset.storage_path,
      contentType: asset.content_type,
    } : null, { assetId, entryId, ownerUserId: access.user.id, petId: access.pet.pet_id });
  } else {
    const { data: moment, error: momentError } = await access.supabase
      .from("life_archive_photo_moments")
      .select("moment_id, life_archive_photos(photo_id, storage_path, content_type)")
      .eq("moment_id", entryId)
      .eq("owner_user_id", access.user.id)
      .eq("pet_id", access.pet.pet_id)
      .eq("life_archive_photos.photo_id", assetId)
      .maybeSingle();
    if (momentError) {
      console.error("[pet-first] legacy Polaroid source lookup failed", { code: momentError.code });
      return errorResponse("unavailable", 503);
    }
    const photo = moment?.life_archive_photos?.find((candidate: { photo_id: string }) => candidate.photo_id === assetId);
    source = authorizeMemoryPolaroidPhoto(photo && moment ? {
      assetId: photo.photo_id,
      entryId: moment.moment_id,
      ownerUserId: access.user.id,
      petId: access.pet.pet_id,
      storageBucket: "life-archive-photos",
      storagePath: photo.storage_path,
      contentType: photo.content_type,
    } : null, { assetId, entryId, ownerUserId: access.user.id, petId: access.pet.pet_id });
  }

  if (!source) return errorResponse("not_found", 404);
  const { data: image, error: downloadError } = await access.supabase.storage
    .from(source.storageBucket)
    .download(source.storagePath);
  if (downloadError || !image) {
    console.error("[pet-first] Polaroid source image download failed", { code: downloadError?.name ?? "missing" });
    return errorResponse("unavailable", 503);
  }
  if (!image.size || image.size > SEASONAL_POLAROID_PHOTO_MAX_BYTES) return errorResponse("invalid_photo", 413);

  return new Response(image, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": source.contentType,
      "Content-Length": String(image.size),
    },
  });
}
