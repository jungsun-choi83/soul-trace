import { NextResponse, type NextRequest } from "next/server";

import { isResultSaveId, resultSaveProofMatches, resultSaveSecret } from "@/lib/result-save-proof";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MAX_IMAGE_LENGTH = 3_500_000;

function isStoredImage(value: string): boolean {
  return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(value) && value.length <= MAX_IMAGE_LENGTH;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {
    resultId?: unknown;
    proof?: unknown;
    title?: unknown;
    caption?: unknown;
    petName?: unknown;
    imageDataUrl?: unknown;
  } | null;
  const resultId = typeof body?.resultId === "string" ? body.resultId : "";
  const proof = typeof body?.proof === "string" ? body.proof : "";
  const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : "";
  const secret = resultSaveSecret();
  if (!secret || !isResultSaveId(resultId) || !resultSaveProofMatches("visual-memory", resultId, proof, secret) || !isStoredImage(imageDataUrl)) {
    return NextResponse.json({ error: "result_unverified" }, { status: 403 });
  }

  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { error: ownerError } = await db.from("soul_trace_owners").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  );
  if (ownerError) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { error } = await db.from("visual_memory_results").insert({
    result_id: resultId,
    owner_user_id: user.id,
    pet_name: typeof body?.petName === "string" ? body.petName.slice(0, 200) : "",
    title: typeof body?.title === "string" ? body.title.slice(0, 120) : "",
    caption: typeof body?.caption === "string" ? body.caption.slice(0, 300) : "",
    image_data_url: imageDataUrl,
  });
  if (!error) return NextResponse.json({ status: "saved" });
  if (error.code === "23505") {
    const { data: existing } = await db
      .from("visual_memory_results")
      .select("owner_user_id")
      .eq("result_id", resultId)
      .maybeSingle();
    if (existing?.owner_user_id === user.id) return NextResponse.json({ status: "already_saved" });
    return NextResponse.json({ error: "result_forbidden" }, { status: 403 });
  }
  return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const resultId = request.nextUrl.searchParams.get("resultId") ?? "";
  if (!isResultSaveId(resultId)) return NextResponse.json({ error: "result_unverified" }, { status: 403 });

  const auth = await createSupabaseAuthServerClient();
  const user = auth ? (await auth.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const db = createSupabaseServerClient();
  if (!db) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("visual_memory_results")
    .select("image_data_url")
    .eq("result_id", resultId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  const stored = typeof data?.image_data_url === "string" ? data.image_data_url : "";
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i.exec(stored);
  if (!match?.[1] || !match[2]) return NextResponse.json({ error: "result_missing" }, { status: 404 });

  const extension = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
  return new NextResponse(Buffer.from(match[2].replace(/\s/g, ""), "base64"), {
    headers: {
      "Content-Type": match[1],
      "Content-Disposition": `attachment; filename="visual-memory.${extension}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
