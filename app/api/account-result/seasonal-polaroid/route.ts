import { NextResponse, type NextRequest } from "next/server";

import { readAiGenerationJob } from "@/lib/ai-generation-guard";
import { seasonalPolaroidCapabilityMatches } from "@/lib/seasonal-polaroid-capability";
import { normalizeSeasonalPolaroidMemo } from "@/lib/seasonal-polaroid-contract";
import { isSeasonalPolaroidResultPath, downloadSeasonalPolaroidResultImage } from "@/lib/seasonal-polaroid-result-storage";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { seasonalPolaroidOwnerMatches } from "@/lib/seasonal-polaroid-ownership";

const RESULT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JOB_ID_PATTERN = /^[0-9a-f]{64}$/i;

function genericError(status: number, error: string): Response {
  return NextResponse.json({ error }, { status });
}

async function authenticatedUser() {
  const auth = await createSupabaseAuthServerClient();
  return auth ? (await auth.auth.getUser()).data.user : null;
}

function verifiedSeasonalResult(
  job: Awaited<ReturnType<typeof readAiGenerationJob>>,
  jobId: string,
  resultId: string,
  capability: string,
) {
  if (
    !job ||
    job.generation_kind !== "seasonal_polaroid" ||
    job.status !== "succeeded" ||
    !job.result ||
    !seasonalPolaroidCapabilityMatches(capability, jobId, job.request_hash) ||
    typeof job.result.resultId !== "string" ||
    job.result.resultId !== resultId
  ) return null;
  const image = job.result.image;
  if (!image || typeof image !== "object") return null;
  const imageRecord = image as Record<string, unknown>;
  if (imageRecord.kind !== "private-object" || typeof imageRecord.objectKey !== "string" || !isSeasonalPolaroidResultPath(jobId, imageRecord.objectKey)) return null;
  const memo = normalizeSeasonalPolaroidMemo(job.result.memo);
  const pet = job.result.pet;
  if (!memo || !pet || typeof pet !== "object") return null;
  const petRecord = pet as Record<string, unknown>;
  if (typeof petRecord.name !== "string" || typeof petRecord.species !== "string" || typeof petRecord.status !== "string") return null;
  return {
    resultId,
    jobId,
    imageObjectKey: imageRecord.objectKey,
    imageMimeType: imageRecord.mimeType === "image/png" ? "image/png" : "image/jpeg",
    memo,
    themeId: typeof job.result.themeId === "string" ? job.result.themeId : "halloween",
    costumeId: typeof job.result.costumeId === "string" ? job.result.costumeId : "",
    pet: {
      name: petRecord.name,
      species: petRecord.species,
      status: petRecord.status,
    },
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json().catch(() => null) as {
    resultId?: unknown;
    jobId?: unknown;
    capability?: unknown;
  } | null;
  const resultId = typeof body?.resultId === "string" ? body.resultId.trim() : "";
  const jobId = typeof body?.jobId === "string" ? body.jobId.trim().toLowerCase() : "";
  const capability = typeof body?.capability === "string" ? body.capability.trim() : "";
  if (!RESULT_ID_PATTERN.test(resultId) || !JOB_ID_PATTERN.test(jobId) || !capability) {
    return genericError(403, "result_unverified");
  }

  const job = await readAiGenerationJob(jobId);
  const verified = verifiedSeasonalResult(job, jobId, resultId, capability);
  if (!verified) return genericError(403, "result_unverified");

  const user = await authenticatedUser();
  if (!user) return genericError(401, "authentication_required");
  if (!seasonalPolaroidOwnerMatches(job?.owner_identity_hash, user.id)) {
    return genericError(403, "result_unverified");
  }
  const db = createSupabaseServerClient();
  if (!db) return genericError(503, "storage_unavailable");

  const { error: ownerError } = await db.from("soul_trace_owners").upsert(
    { user_id: user.id },
    { onConflict: "user_id" },
  );
  if (ownerError) return genericError(503, "storage_unavailable");

  const { error } = await db.from("seasonal_polaroid_results").insert({
    result_id: verified.resultId,
    job_id: verified.jobId,
    owner_user_id: user.id,
    pet_name: verified.pet.name.slice(0, 200),
    species: verified.pet.species.slice(0, 32),
    status: verified.pet.status,
    theme_id: verified.themeId.slice(0, 32),
    costume_id: verified.costumeId.slice(0, 64),
    image_object_key: verified.imageObjectKey,
    memo_line_1: verified.memo.lines[0],
    memo_line_2: verified.memo.lines[1],
    memo_line_3: verified.memo.lines[2],
    memo_line_4: verified.memo.lines[3],
    memo_locale: verified.memo.locale,
    generation_metadata: job?.result && typeof job.result.generation === "object" ? job.result.generation : {},
  });
  if (!error) return NextResponse.json({ status: "saved", resultId });
  if (error.code === "23505") {
    const { data: existing } = await db
      .from("seasonal_polaroid_results")
      .select("owner_user_id")
      .eq("result_id", resultId)
      .maybeSingle();
    if (existing?.owner_user_id === user.id) return NextResponse.json({ status: "already_saved", resultId });
    return genericError(403, "result_forbidden");
  }
  return genericError(503, "storage_unavailable");
}

export async function GET(request: NextRequest): Promise<Response> {
  const resultId = request.nextUrl.searchParams.get("resultId")?.trim() ?? "";
  if (!RESULT_ID_PATTERN.test(resultId)) return genericError(404, "result_missing");
  const user = await authenticatedUser();
  if (!user) return genericError(401, "authentication_required");
  const db = createSupabaseServerClient();
  if (!db) return genericError(503, "storage_unavailable");
  const { data, error } = await db
    .from("seasonal_polaroid_results")
    .select("job_id, image_object_key")
    .eq("result_id", resultId)
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (error) return genericError(503, "storage_unavailable");
  if (!data || typeof data.job_id !== "string" || typeof data.image_object_key !== "string") return genericError(404, "result_missing");
  if (!JOB_ID_PATTERN.test(data.job_id) || !isSeasonalPolaroidResultPath(data.job_id, data.image_object_key)) return genericError(404, "result_missing");
  const storage = createSupabaseServerClient();
  if (!storage) return genericError(503, "storage_unavailable");
  const image = await downloadSeasonalPolaroidResultImage({ storage, objectKey: data.image_object_key });
  if (!image) return genericError(404, "result_missing");
  return new Response(image, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `inline; filename="soul-trace-polaroid.jpg"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
