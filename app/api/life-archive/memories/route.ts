import { NextResponse, type NextRequest } from "next/server";

import { ACTIVE_SUBMISSION_COOKIE } from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function selectedArchive(request: NextRequest, requestedSubmissionId?: string) {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  const submissionId = requestedSubmissionId || request.cookies.get(ACTIVE_SUBMISSION_COOKIE)?.value;
  if (!userData.user || !submissionId || !UUID_PATTERN.test(submissionId)) return null;

  const { data: submission } = await supabase
    .from("soul_trace_submissions")
    .select("submission_id, pet_id")
    .eq("submission_id", submissionId)
    .eq("owner_user_id", userData.user.id)
    .maybeSingle();

  return submission
    ? { supabase, userId: userData.user.id, submission }
    : null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    submissionId?: unknown;
    title?: unknown;
    story?: unknown;
    memoryDate?: unknown;
  } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
  const archive = await selectedArchive(request, submissionId);
  if (!archive) {
    return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  }
  const title = typeof body?.title === "string" ? body.title : "";
  const story = typeof body?.story === "string" ? body.story : "";
  const memoryDate = typeof body?.memoryDate === "string" ? body.memoryDate : "";

  if (!story.trim() || story.length > 10_000 || title.length > 160) {
    return NextResponse.json({ error: "invalid_memory" }, { status: 400 });
  }
  if (memoryDate && !isRealDate(memoryDate)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const { data, error } = await archive.supabase
    .from("life_archive_memories")
    .insert({
      owner_user_id: archive.userId,
      pet_id: archive.submission.pet_id,
      submission_id: archive.submission.submission_id,
      title: title.trim() ? title : null,
      story,
      memory_date: memoryDate || null,
    })
    .select("memory_id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "created", memoryId: data.memory_id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { memoryId?: unknown; submissionId?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : "";
  const archive = await selectedArchive(request, submissionId);
  if (!archive) {
    return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
  }
  const memoryId = typeof body?.memoryId === "string" ? body.memoryId : "";
  if (!UUID_PATTERN.test(memoryId)) {
    return NextResponse.json({ error: "invalid_memory" }, { status: 400 });
  }

  const { error } = await archive.supabase
    .from("life_archive_memories")
    .delete()
    .eq("memory_id", memoryId)
    .eq("submission_id", archive.submission.submission_id)
    .eq("owner_user_id", archive.userId);

  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ status: "deleted" });
}
