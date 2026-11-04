import {
  isOwnerStoragePath,
  parseCaptionAndDate,
  petFirstStoragePath,
  validateVideoFile,
  videoExtension,
} from "@/lib/pet-first-archive";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const form = await request.formData();
  const file = form.get("video");
  const caption = String(form.get("caption") ?? "");
  const memoryDate = String(form.get("memoryDate") ?? "");
  const duration = Number(form.get("duration"));
  if (!(file instanceof File) || validateVideoFile({ type: file.type, size: file.size }, duration, caption, memoryDate) !== "ok") {
    return privateJson({ error: "invalid_video" }, 400);
  }
  const metadata = parseCaptionAndDate(caption, memoryDate);
  if (!metadata.ok) return privateJson({ error: "invalid_video" }, 400);
  const extension = videoExtension(file.type);
  if (!extension) return privateJson({ error: "invalid_video" }, 400);

  const { data: entry, error } = await access.supabase
    .from("pet_timeline_entries")
    .insert({
      owner_user_id: access.user.id,
      pet_id: access.pet.pet_id,
      kind: "video",
      title: metadata.caption,
      story: null,
      happened_on: metadata.happenedOn,
      visibility: "private",
      origin: "pet_first_archive",
    })
    .select("entry_id")
    .single();
  if (error || !entry) {
    console.error("[pet-first] video entry failed", { code: error?.code });
    return privateJson({ error: "save_failed" }, 500);
  }

  const path = petFirstStoragePath({
    userId: access.user.id,
    petId: access.pet.pet_id,
    entryId: entry.entry_id,
    assetId: crypto.randomUUID(),
    extension,
  });
  if (!isOwnerStoragePath(path, access.user.id)) {
    await access.supabase.from("pet_timeline_entries").delete().eq("entry_id", entry.entry_id).eq("owner_user_id", access.user.id);
    return privateJson({ error: "upload_failed" }, 500);
  }
  const upload = await access.supabase.storage.from("life-archive-videos").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upload.error) {
    console.error("[pet-first] video upload failed", { code: upload.error.message ? "storage_rejected" : "upload_failed" });
    await access.supabase.from("pet_timeline_entries").delete().eq("entry_id", entry.entry_id).eq("owner_user_id", access.user.id);
    return privateJson({ error: "upload_failed" }, 500);
  }
  const asset = await access.supabase.from("pet_timeline_assets").insert({
    entry_id: entry.entry_id,
    owner_user_id: access.user.id,
    pet_id: access.pet.pet_id,
    storage_bucket: "life-archive-videos",
    storage_path: path,
    content_type: file.type,
    byte_size: file.size,
    asset_order: 0,
  });
  if (asset.error) {
    console.error("[pet-first] video asset failed", { code: asset.error.code });
    await access.supabase.storage.from("life-archive-videos").remove([path]);
    await access.supabase.from("pet_timeline_entries").delete().eq("entry_id", entry.entry_id).eq("owner_user_id", access.user.id);
    return privateJson({ error: "save_failed" }, 500);
  }
  return privateJson({ entryId: entry.entry_id }, 201);
}
