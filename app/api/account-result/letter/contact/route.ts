import { NextResponse, type NextRequest } from "next/server";

import { normalizeAuthEmail } from "@/lib/passwordless-auth";
import { isResultSaveId, resultSaveProofMatches, resultSaveSecret } from "@/lib/result-save-proof";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { letterId?: unknown; proof?: unknown } | null;
  const letterId = typeof body?.letterId === "string" ? body.letterId : "";
  const proof = typeof body?.proof === "string" ? body.proof : "";
  const secret = resultSaveSecret();
  if (!secret || !isResultSaveId(letterId) || !resultSaveProofMatches("letter", letterId, proof, secret)) {
    return NextResponse.json({ error: "result_unverified" }, { status: 403 });
  }

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("soul_trace_profiles")
    .select("user_email")
    .eq("letter_id", letterId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const email = normalizeAuthEmail(typeof data?.user_email === "string" ? data.user_email : "");
  if (!email) return NextResponse.json({ error: "result_missing" }, { status: 404 });
  return NextResponse.json({ email });
}
