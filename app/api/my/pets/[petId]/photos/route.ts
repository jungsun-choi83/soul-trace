import {
  isOwnerStoragePath,
  petFirstStoragePath,
  photoExtension,
  validatePhotoFiles,
} from "@/lib/pet-first-archive";
import { parseOptionalPlace } from "@/lib/memory-library";
import { parsePhotoBatchDates, persistDatedPhotoBatch } from "@/lib/photo-batch";
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
  const caption = String(form.get("caption") ?? "");
  const submittedDates = form.getAll("photoDates");
  const legacyDate = String(form.get("memoryDate") ?? "");
  const photoMetadata = parsePhotoBatchDates(caption, submittedDates, legacyDate, files.length);
  if (!photoMetadata.ok) return privateJson({ error: "invalid_metadata" }, 400);
  const place = parseOptionalPlace(form.get("place"));
  if (place === undefined) return privateJson({ error: "invalid_metadata" }, 400);

  const result = await persistDatedPhotoBatch(files.map((file, index) => ({
    file,
    happenedOn: photoMetadata.happenedOn[index] ?? null,
  })), {
    async createEntry(photo) {
      const fullInsert = {
        owner_user_id: access.user.id,
        pet_id: access.pet.pet_id,
        kind: "photo" as const,
        title: photoMetadata.caption,
        story: null,
        happened_on: photo.happenedOn,
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
            title: photoMetadata.caption,
            story: null,
            happened_on: photo.happenedOn,
            visibility: "private",
            origin: "pet_first_archive",
          })
          .select("entry_id")
          .single();
      if (error || !entry) throw error ?? new Error("photo_entry_failed");
      return { entryId: entry.entry_id };
    },
    async uploadAndLink(entry, photo, _index, onUploaded) {
      const file = photo.file;
      const extension = photoExtension(file.type);
      if (!extension) throw new Error("invalid_photo_type");
      const path = petFirstStoragePath({
        userId: access.user.id,
        petId: access.pet.pet_id,
        entryId: entry.entryId,
        assetId: crypto.randomUUID(),
        extension,
      });
      if (!isOwnerStoragePath(path, access.user.id)) throw new Error("invalid_storage_path");
      const upload = await access.supabase.storage.from("life-archive-photos").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) throw upload.error;
      onUploaded(path);
      const asset = await access.supabase.from("pet_timeline_assets").insert({
        entry_id: entry.entryId,
        owner_user_id: access.user.id,
        pet_id: access.pet.pet_id,
        storage_bucket: "life-archive-photos",
        storage_path: path,
        content_type: file.type,
        byte_size: file.size,
        asset_order: 0,
      });
      if (asset.error) throw asset.error;
    },
    async rollback(entryIds, uploaded) {
      if (uploaded.length) {
        const removed = await access.supabase.storage.from("life-archive-photos").remove(uploaded);
        if (removed.error) console.error("[pet-first] photo storage rollback failed");
      }
      if (entryIds.length) {
        const removed = await access.supabase.from("pet_timeline_entries")
          .delete()
          .in("entry_id", entryIds)
          .eq("owner_user_id", access.user.id)
          .eq("pet_id", access.pet.pet_id);
        if (removed.error) console.error("[pet-first] photo entry rollback failed", { code: removed.error.code });
      }
    },
  });
  if (!result.ok) {
    console.error("[pet-first] photo batch failed", {
      stage: result.stage,
      code: result.error && typeof result.error === "object" && "code" in result.error ? result.error.code : "upload_failed",
    });
    return privateJson({ error: result.stage === "entry" ? "save_failed" : "upload_failed" }, 500);
  }

  return privateJson({ entryId: result.entryIds[0], entryIds: result.entryIds }, 201);
}
