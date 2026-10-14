import { aiGenerationIdentityHash, readAiGenerationJob } from "@/lib/ai-generation-guard";
import {
  issueSeasonalPolaroidImageAccessToken,
  seasonalPolaroidCapabilityMatches,
} from "@/lib/seasonal-polaroid-capability";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import {
  seasonalPolaroidAccessAllowed,
  seasonalPolaroidDeveloperRequestAllowed,
} from "@/lib/seasonal-polaroid-access";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const runtime = "nodejs";
export const maxDuration = 10;

const GENERATION_KINDS = new Set(["letter", "visual_memory", "seasonal_polaroid"]);
// Seasonal admission is disabled until its generator and capability issuance
// are deployed. Do not let a manually inserted or guessed Seasonal job ID
// become a result-read capability in the meantime.
const SEASONAL_STATUS_ENABLED = isSeasonalPolaroidEnabled();
const SEASONAL_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};

function seasonalPrivateResponse(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...SEASONAL_PRIVATE_HEADERS, ...(init.headers ?? {}) },
  });
}

function seasonalStatusResult(
  result: Record<string, unknown>,
  imageAccessToken: string,
): Record<string, unknown> {
  const image = result.image;
  if (!image || typeof image !== "object") return { resultId: result.resultId ?? null, image: null };
  const imageRecord = image as Record<string, unknown>;
  return {
    resultId: typeof result.resultId === "string" ? result.resultId : null,
    image: {
      kind: "private-proxy",
      endpoint: "/api/seasonal-polaroid/image",
      mimeType: imageRecord.mimeType === "image/png" ? "image/png" : "image/jpeg",
      accessToken: imageAccessToken,
    },
    memo: result.memo ?? null,
    themeId: result.themeId ?? null,
    costumeId: result.costumeId ?? null,
    pet: result.pet ?? null,
    generation: result.generation ?? null,
  };
}

/**
 * Job IDs are 256-bit capability tokens derived from the logical request. The
 * endpoint intentionally returns the same 404 for an unknown or mismatched job
 * so callers cannot enumerate another user's generations.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId")?.trim().toLowerCase() ?? "";
  const kind = searchParams.get("kind")?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/.test(jobId) || !GENERATION_KINDS.has(kind)) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }
  if (kind === "seasonal_polaroid" && !SEASONAL_STATUS_ENABLED) {
    return seasonalPrivateResponse({ error: "Generation not found." }, { status: 404 });
  }
  if (kind === "seasonal_polaroid" && !(await seasonalPolaroidAccessAllowed(request))) {
    return seasonalPrivateResponse({ error: "Generation not found." }, { status: 404 });
  }
  if (kind === "seasonal_polaroid" && !seasonalPolaroidDeveloperRequestAllowed(request)) {
    const auth = await createSupabaseAuthServerClient();
    const user = auth ? (await auth.auth.getUser()).data.user : null;
    if (!user) return seasonalPrivateResponse({ error: "Generation not found." }, { status: 404 });
  }

  const job = await readAiGenerationJob(jobId);
  if (!job || job.generation_kind !== kind) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }
  if (kind === "seasonal_polaroid") {
    const capability = request.headers.get("x-soul-trace-seasonal-capability")?.trim() ?? "";
    if (!seasonalPolaroidCapabilityMatches(capability, jobId, job.request_hash)) {
      return Response.json({ error: "Generation not found." }, { status: 404 });
    }
  }
  if (kind === "letter") {
    const email = searchParams.get("email")?.trim() ?? "";
    const ownerHash = aiGenerationIdentityHash(email);
    if (!ownerHash || job.owner_identity_hash !== ownerHash) {
      return Response.json({ error: "Generation not found." }, { status: 404 });
    }
  }

  if (job.status === "succeeded" && job.result) {
    if (kind === "seasonal_polaroid") {
      const imageAccessToken = issueSeasonalPolaroidImageAccessToken(jobId, job.request_hash);
      if (!imageAccessToken) return seasonalPrivateResponse({ error: "Generation not found." }, { status: 404 });
      return seasonalPrivateResponse({
        status: "succeeded",
        jobId,
        result: seasonalStatusResult(job.result, imageAccessToken),
      });
    }
    return Response.json({
      status: "succeeded",
      jobId,
      result: job.result,
    });
  }
  if (job.status === "failed") {
    const body = {
      status: "failed",
      jobId,
      error: "Generation could not be completed. Please try again.",
    };
    return kind === "seasonal_polaroid"
      ? seasonalPrivateResponse(body)
      : Response.json(body);
  }
  return kind === "seasonal_polaroid"
    ? seasonalPrivateResponse({
      status: job.status === "processing" ? "processing" : "queued",
      jobId,
    }, { headers: { "Retry-After": "3" } })
    : Response.json({
    status: job.status === "processing" ? "processing" : "queued",
    jobId,
  }, { headers: { "Retry-After": "3" } });
}
