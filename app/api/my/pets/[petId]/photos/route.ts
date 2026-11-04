import {
  isOwnerStoragePath,
  parseCaptionAndDate,
  petFirstStoragePath,
  photoExtension,
  validatePhotoFiles,
} from "@/lib/pet-first-archive";
import { parseOptionalPlace } from "@/lib/memory-library";
import { privateJson, requireOwnedPet } from "@/lib/pet-first-archive-server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ petId: string }> },
) {
  const { petId } = await params;
  const access = await requireOwnedPet(petId);
  if (!access.ok) return access.response;
  const form = await request.formData();
  const files = form.getAll("photos").filter((value): value is File => value instanceof File);
  if (validatePhotoFiles(files.map((file) => ({ type: file.type, size: file.size }))) !== "ok") {
    return privateJson({ error: "invalid_photos" }, 400);
  }
  const metadata = parseCaptionAndDate(String(form.get("caption") ?? ""), String(form.get("memoryDate") ?? ""));
  if (!metadata.ok) return privateJson({ error: metadata.error }, 400);
  const place = parseOptionalPlace(form.get("place"));
  if (place === undefined) return privateJson({ error: "invalid_metadata" }, 400);

  const fullInsert = {
    owner_user_id: access.user.id,
    pet_id: access.pet.pet_id,
    kind: "photo" as const,
    title: metadata.caption,
    story: null,
    happened_on: metadata.happenedOn,
    place,
    favorite: false,
    visibility: "private",
    origin: "pet_first_archive",
  };
  const inserted = await access.supabase
    .from("pet_timeline_entries")
    .insert(fullInsert)
    .select("entry_id")
    .single();
  const { data: entry, error } = !inserted.error || inserted.error.code !== "42703"
    ? inserted
    : await access.supabase
      .from("pet_timeline_entries")
      .insert({
        owner_user_id: access.user.id,
        pet_id: access.pet.pet_id,
        kind: "photo",
        title: metadata.caption,
        story: null,
        happened_on: metadata.happenedOn,
        visibility: "private",
        origin: "pet_first_archive",
      })
    .select("entry_id")
    .single();
  if (error || !entry) {
    console.error("[pet-first] photo entry failed", { code: error?.code });
    return privateJson({ error: "save_failed" }, 500);
  }

  const uploaded: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const extension = photoExtension(file.type);
      if (!extension) throw new Error("invalid_photo_type");
      const path = petFirstStoragePath({
        userId: access.user.id,
        petId: access.pet.pet_id,
        entryId: entry.entry_id,
        assetId: crypto.randomUUID(),
        extension,
      });
      if (!isOwnerStoragePath(path, access.user.id)) throw new Error("invalid_storage_path");
      const upload = await access.supabase.storage.from("life-archive-photos").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      uploaded.push(path);
      const asset = await access.supabase.from("pet_timeline_assets").insert({
        entry_id: entry.entry_id,
        owner_user_id: access.user.id,
        pet_id: access.pet.pet_id,
        storage_bucket: "life-archive-photos",
        storage_path: path,
        content_type: file.type,
        byte_size: file.size,
        asset_order: index,
      });
      if (asset.error) throw asset.error;
    }
  } catch (uploadError) {
    console.error("[pet-first] photo upload failed", {
      code: uploadError && typeof uploadError === "object" && "code" in uploadError ? uploadError.code : "upload_failed",
    });
    if (uploaded.length) await access.supabase.storage.from("life-archive-photos").remove(uploaded);
    await access.supabase.from("pet_timeline_entries").delete().eq("entry_id", entry.entry_id).eq("owner_user_id", access.user.id);
    return privateJson({ error: "upload_failed" }, 500);
  }

  return privateJson({ entryId: entry.entry_id }, 201);
}
