import { NextResponse, type NextRequest } from "next/server";

import { letterAttachmentDecision } from "@/lib/attach-current-letter";
import { isResultSaveId, resultSaveProofMatches, resultSaveSecret } from "@/lib/result-save-proof";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { letterId?: unknown; proof?: unknown } | null;
  const letterId = typeof body?.letterId === "string" ? body.letterId : "";
  const proof = typeof body?.proof === "string" ? body.proof : "";
  const secret = resultSaveSecret();
  if (!secret || !isResultSaveId(letterId) || !resultSaveProofMatches("letter", letterId, proof, secret)) {
    return NextResponse.json({ error: "result_unverified" }, { status: 403 });
  }

  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data: submission, error } = await db
    .from("soul_trace_submissions")
    .select("submission_id, owner_user_id, pet_id")
    .eq("letter_id", letterId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  if (!submission?.submission_id) return NextResponse.json({ error: "result_missing" }, { status: 404 });

  const decision = letterAttachmentDecision(submission.owner_user_id, user.id);
  if (decision === "forbidden") return NextResponse.json({ error: "result_forbidden" }, { status: 403 });
  if (decision === "already_saved") return NextResponse.json({ status: "already_saved" });

  const { error: ownerError } = await db.from("soul_trace_owners").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  );
  if (ownerError) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data: claimed, error: claimError } = await db
    .from("soul_trace_submissions")
    .update({ owner_user_id: user.id })
    .eq("submission_id", submission.submission_id)
    .is("owner_user_id", null)
    .select("submission_id");
  if (claimError) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  if (!claimed?.length) {
    const { data: current } = await db
      .from("soul_trace_submissions")
      .select("owner_user_id")
      .eq("submission_id", submission.submission_id)
      .maybeSingle();
    if (current?.owner_user_id === user.id) return NextResponse.json({ status: "already_saved" });
    return NextResponse.json({ error: "result_forbidden" }, { status: 403 });
  }

  if (submission.pet_id) {
    await db
      .from("soul_trace_pets")
      .update({ owner_user_id: user.id })
      .eq("pet_id", submission.pet_id)
      .is("owner_user_id", null);
  }

  return NextResponse.json({ status: "saved" });
}
