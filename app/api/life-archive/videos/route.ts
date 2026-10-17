import { NextResponse, type NextRequest } from "next/server";

import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_SECONDS = 30;
const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function archiveContext(request: NextRequest) {
  const supabase = await createSupabaseAuthServerClient();
  const user = (await supabase?.auth.getUser())?.data.user;
  const submissionId = request.nextUrl.searchParams.get("submissionId")
    || request.cookies.get(ACTIVE_SUBMISSION_COOKIE)?.value;
  if (!supabase || !user || !submissionId || !UUID_PATTERN.test(submissionId)) return null;
  const { data: submission } = await supabase.from("soul_trace_submissions")
    .select("submission_id, pet_id").eq("submission_id", submissionId)
    .eq("owner_user_id", user.id).maybeSingle();
  return submission ? { supabase, user, submission } : null;
}

export async function GET(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const { data, error } = await context.supabase.from("life_archive_videos")
    .select("video_id, storage_path, caption, memory_date, duration_seconds, is_favorite, created_at")
    .eq("owner_user_id", context.user.id).eq("submission_id", context.submission.submission_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "load_failed" }, { status: 500 });
  const videos = await Promise.all((data ?? []).map(async (video) => {
    const { data: signed } = await context.supabase.storage.from("life-archive-videos")
      .createSignedUrl(video.storage_path, 3600);
    return { videoId: video.video_id, url: signed?.signedUrl ?? null, caption: video.caption ?? "", memoryDate: video.memory_date, duration: video.duration_seconds, isFavorite: video.is_favorite, createdAt: video.created_at };
  }));
  return NextResponse.json({ videos: videos.filter((video) => video.url) });
}

export async function POST(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const form = await request.formData();
  const file = form.get("video");
  const caption = String(form.get("caption") ?? "");
  const memoryDate = String(form.get("memoryDate") ?? "");
  const duration = Number(form.get("duration"));
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size < 1 || file.size > MAX_BYTES || caption.length > 500 || !Number.isFinite(duration) || duration <= 0 || duration > MAX_SECONDS || (memoryDate && !/^\d{4}-\d{2}-\d{2}$/.test(memoryDate))) {
    return NextResponse.json({ error: "invalid_video" }, { status: 400 });
  }
  const videoId = crypto.randomUUID();
  const extension = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1];
  const path = `${context.user.id}/${context.submission.pet_id}/${videoId}/video.${extension}`;
  const upload = await context.supabase.storage.from("life-archive-videos").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  const { error } = await context.supabase.from("life_archive_videos").insert({
    video_id: videoId, owner_user_id: context.user.id, pet_id: context.submission.pet_id,
    submission_id: context.submission.submission_id, storage_path: path,
    caption: caption || null, memory_date: memoryDate || null, content_type: file.type,
    byte_size: file.size, duration_seconds: duration,
  });
  if (error) {
    await context.supabase.storage.from("life-archive-videos").remove([path]);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ videoId }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { videoId?: unknown } | null;
  const videoId = typeof body?.videoId === "string" ? body.videoId : "";
  if (!UUID_PATTERN.test(videoId)) return NextResponse.json({ error: "invalid_video" }, { status: 400 });
  const { data: video } = await context.supabase.from("life_archive_videos").select("storage_path")
    .eq("video_id", videoId).eq("submission_id", context.submission.submission_id)
    .eq("owner_user_id", context.user.id).maybeSingle();
  if (!video) return NextResponse.json({ error: "video_forbidden" }, { status: 404 });
  const { error } = await context.supabase.from("life_archive_videos").delete().eq("video_id", videoId)
    .eq("owner_user_id", context.user.id).eq("submission_id", context.submission.submission_id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  await context.supabase.storage.from("life-archive-videos").remove([video.storage_path]);
  return NextResponse.json({ status: "deleted" });
}

export async function PATCH(request: NextRequest) {
  const context = await archiveContext(request);
  if (!context) return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { videoId?: unknown; isFavorite?: unknown } | null;
  if (typeof body?.videoId !== "string" || !UUID_PATTERN.test(body.videoId) || typeof body.isFavorite !== "boolean") return NextResponse.json({ error: "invalid_update" }, { status: 400 });
  const { error } = await context.supabase.from("life_archive_videos").update({ is_favorite: body.isFavorite, updated_at: new Date().toISOString() })
    .eq("video_id", body.videoId).eq("owner_user_id", context.user.id)
    .eq("submission_id", context.submission.submission_id);
  return error ? NextResponse.json({ error: "update_failed" }, { status: 500 }) : NextResponse.json({ status: "updated" });
}
