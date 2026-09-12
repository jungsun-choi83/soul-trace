import { NextResponse, type NextRequest } from "next/server";

import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function archiveContext(request: NextRequest) {
  const supabase = await createSupabaseAuthServerClient();
  const user = (await supabase?.auth.getUser())?.data.user;
  const submissionId = request.nextUrl.searchParams.get("submissionId")
    || request.cookies.get(ACTIVE_SUBMISSION_COOKIE)?.value;
  if (!supabase || !user || !submissionId) return null;
  const { data: submission } = await supabase
    .from("soul_trace_submissions")
    .select("submission_id, pet_id")
    .eq("submission_id", submissionId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  return submission ? { supabase, user, submission } : null;
}

export async function GET(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const { data: moments, error } = await context.supabase
    .from("life_archive_photo_moments")
    .select("moment_id, caption, memory_date, layout, center_photo_id, is_favorite, created_at, life_archive_photos(photo_id, storage_path, photo_order)")
    .eq("owner_user_id", context.user.id)
    .eq("submission_id", context.submission.submission_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "load_failed" }, { status: 500 });
  const result = await Promise.all((moments ?? []).map(async (moment) => {
    const photos = [...(moment.life_archive_photos ?? [])].sort((a, b) => a.photo_order - b.photo_order);
    const signed = await Promise.all(photos.map(async (photo) => {
      const { data } = await context.supabase.storage.from("life-archive-photos").createSignedUrl(photo.storage_path, 3600);
      return { photoId: photo.photo_id, url: data?.signedUrl ?? null, photoOrder: photo.photo_order };
    }));
    return { ...moment, photos: signed.filter((photo) => photo.url) };
  }));
  return NextResponse.json({ moments: result });
}

export async function POST(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const form = await request.formData();
  const files = form.getAll("photos").filter((value): value is File => value instanceof File);
  if (!files.length || files.length > MAX_PHOTOS || files.some((file) => !TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES)) {
    return NextResponse.json({ error: "invalid_photos" }, { status: 400 });
  }
  const caption = String(form.get("caption") ?? "");
  const memoryDate = String(form.get("memoryDate") ?? "");
  const layout = String(form.get("layout") ?? "clean-grid");
  if (caption.length > 500 || (memoryDate && !/^\d{4}-\d{2}-\d{2}$/.test(memoryDate)) || !["classic-centre", "clean-grid", "scrapbook"].includes(layout)) {
    return NextResponse.json({ error: "invalid_metadata" }, { status: 400 });
  }
  const { data: moment, error } = await context.supabase.from("life_archive_photo_moments").insert({
    owner_user_id: context.user.id,
    pet_id: context.submission.pet_id,
    submission_id: context.submission.submission_id,
    caption: caption || null,
    memory_date: memoryDate || null,
    layout,
  }).select("moment_id").single();
  if (error || !moment) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  const uploaded: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const path = `${context.user.id}/${context.submission.pet_id}/${context.submission.submission_id}/${moment.moment_id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const upload = await context.supabase.storage.from("life-archive-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) throw upload.error;
      uploaded.push(path);
      const photo = await context.supabase.from("life_archive_photos").insert({ moment_id: moment.moment_id, owner_user_id: context.user.id, storage_path: path, photo_order: index, content_type: file.type, byte_size: file.size });
      if (photo.error) throw photo.error;
    }
  } catch {
    if (uploaded.length) await context.supabase.storage.from("life-archive-photos").remove(uploaded);
    await context.supabase.from("life_archive_photo_moments").delete().eq("moment_id", moment.moment_id);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }
  return NextResponse.json({ momentId: moment.moment_id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { momentId?: unknown } | null;
  const momentId = typeof body?.momentId === "string" ? body.momentId : "";
  const { data: photos } = await context.supabase.from("life_archive_photos").select("storage_path").eq("moment_id", momentId).eq("owner_user_id", context.user.id);
  if (photos?.length) await context.supabase.storage.from("life-archive-photos").remove(photos.map((photo) => photo.storage_path));
  await context.supabase.from("life_archive_photo_moments").delete().eq("moment_id", momentId).eq("owner_user_id", context.user.id);
  return NextResponse.json({ status: "deleted" });
}

export async function PATCH(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { momentId?: unknown; isFavorite?: unknown } | null;
  if (typeof body?.momentId !== "string" || typeof body.isFavorite !== "boolean") return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  const { error } = await context.supabase.from("life_archive_photo_moments").update({ is_favorite: body.isFavorite, updated_at: new Date().toISOString() }).eq("moment_id", body.momentId).eq("owner_user_id", context.user.id).eq("submission_id", context.submission.submission_id);
  return error ? NextResponse.json({ error: "update_failed" }, { status: 500 }) : NextResponse.json({ status: "updated" });
}
