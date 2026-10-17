import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createLetterShareToken, hashLetterShareToken, letterShareExpiry } from "@/lib/letter-share";
import { isResultSaveId, resultSaveProofMatches, resultSaveSecret } from "@/lib/result-save-proof";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { letterId?: unknown; proof?: unknown } | null;
  const letterId = typeof body?.letterId === "string" ? body.letterId.trim() : "";
  const proof = typeof body?.proof === "string" ? body.proof.trim() : "";
  const secret = resultSaveSecret();
  if (!secret || !isResultSaveId(letterId) || !resultSaveProofMatches("letter", letterId, proof, secret)) {
    return NextResponse.json({ error: "share_unverified" }, { status: 403 });
  }

  // The signed result proof is the capability issued for the current letter.
  // Authentication is used when available to bind an already-owned submission,
  // but legacy letters may be shared before an account session exists.
  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data: submission, error: submissionError } = await db
    .from("soul_trace_submissions")
    .select("letter_id, owner_user_id, generated_letter")
    .eq("letter_id", letterId)
    .maybeSingle();
  if (submissionError) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  if (!submission?.generated_letter || (submission.owner_user_id && submission.owner_user_id !== user?.id)) {
    return NextResponse.json({ error: "share_forbidden" }, { status: 403 });
  }

  const token = createLetterShareToken();
  const expiresAt = letterShareExpiry();
  const { error: insertError } = await db.from("letter_shares").insert({
    token_hash: hashLetterShareToken(token),
    letter_id: letterId,
    owner_user_id: user?.id ?? submission.owner_user_id ?? null,
    expires_at: expiresAt,
  });
  if (insertError) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const url = new URL(`/shared-letter/${token}`, request.url).toString();
  return NextResponse.json({ url, expiresAt }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
