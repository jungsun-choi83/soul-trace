import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { authenticateAuthCallback } from "@/lib/auth-confirm";
import { safeAuthConfirmationPath, safeAuthErrorPath } from "@/lib/auth-redirect";
import {
  AUTH_LOCALE_COOKIE,
  normalizeAuthLocale,
} from "@/lib/passwordless-auth";
import {
  ACTIVE_SUBMISSION_COOKIE,
  ACTIVE_SUBMISSION_MAX_AGE,
  lifeArchiveCookieOptions,
  PENDING_LETTER_COOKIE,
} from "@/lib/life-archive-session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const locale = normalizeAuthLocale(request.nextUrl.searchParams.get("locale"));
  const next = safeAuthConfirmationPath(
    request.nextUrl.searchParams.get("next"),
    "/life-archive",
  );
  const destination = new URL(next, request.url);
  const errorPath = safeAuthErrorPath(
    request.nextUrl.searchParams.get("errorTo"),
    next,
  );
  const errorDestination = new URL(errorPath, request.url);
  const supabase = await createSupabaseAuthServerClient();
  const redirectWithLocale = (destinationUrl: URL) => {
    const response = NextResponse.redirect(destinationUrl);
    response.cookies.set(AUTH_LOCALE_COOKIE, locale, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  };

  if (!supabase) {
    errorDestination.searchParams.set("authError", "verification_failed");
    return redirectWithLocale(errorDestination);
  }

  const result = await authenticateAuthCallback(supabase, {
    code,
    tokenHash,
    type,
  });

  if (result === "verification_failed") {
    errorDestination.searchParams.set("authError", "verification_failed");
    return redirectWithLocale(errorDestination);
  }

  const response = redirectWithLocale(destination);
  const pendingLetterId = request.cookies.get(PENDING_LETTER_COOKIE)?.value;
  const { data: userData } = await supabase.auth.getUser();

  if (pendingLetterId && userData.user) {
    const { data: submission } = await supabase
      .from("soul_trace_submissions")
      .select("submission_id")
      .eq("letter_id", pendingLetterId)
      .eq("owner_user_id", userData.user.id)
      .maybeSingle();

    if (submission?.submission_id) {
      response.cookies.set(
        ACTIVE_SUBMISSION_COOKIE,
        submission.submission_id,
        lifeArchiveCookieOptions(ACTIVE_SUBMISSION_MAX_AGE),
      );
    }
    response.cookies.delete(PENDING_LETTER_COOKIE);
  }

  return response;
}
