import { NextResponse, type NextRequest } from "next/server";

import { requestLetterOwnerVerification } from "@/lib/life-archive-auth";
import {
  ACTIVE_SUBMISSION_COOKIE,
  ACTIVE_SUBMISSION_MAX_AGE,
  lifeArchiveCookieOptions,
  PENDING_LETTER_COOKIE,
} from "@/lib/life-archive-session";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { letterId?: unknown } | null;
  const letterId = typeof body?.letterId === "string" ? body.letterId : "";
  if (!UUID_PATTERN.test(letterId)) {
    return NextResponse.json({ error: "archive_unavailable" }, { status: 400 });
  }

  const supabase = await createSupabaseAuthServerClient();
  const { data: userData } = supabase
    ? await supabase.auth.getUser()
    : { data: { user: null } };

  if (supabase && userData.user) {
    await supabase.rpc("claim_soul_trace_legacy_records");
    const { data: submission } = await supabase
      .from("soul_trace_submissions")
      .select("submission_id")
      .eq("letter_id", letterId)
      .eq("owner_user_id", userData.user.id)
      .maybeSingle();

    if (!submission?.submission_id) {
      return NextResponse.json({ error: "archive_forbidden" }, { status: 403 });
    }

    const response = NextResponse.json({ status: "ready", href: "/life-archive" });
    response.cookies.set(
      ACTIVE_SUBMISSION_COOKIE,
      submission.submission_id,
      lifeArchiveCookieOptions(ACTIVE_SUBMISSION_MAX_AGE),
    );
    response.cookies.delete(PENDING_LETTER_COOKIE);
    return response;
  }

  try {
    await requestLetterOwnerVerification(letterId, request.nextUrl.origin);
  } catch {
    return NextResponse.json({ error: "archive_unavailable" }, { status: 503 });
  }

  const response = NextResponse.json({ status: "verification_required" });
  response.cookies.set(
    PENDING_LETTER_COOKIE,
    letterId,
    lifeArchiveCookieOptions(60 * 15),
  );
  return response;
}
