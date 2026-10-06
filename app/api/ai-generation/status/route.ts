import { aiGenerationIdentityHash, readAiGenerationJob } from "@/lib/ai-generation-guard";

export const runtime = "nodejs";
export const maxDuration = 10;

const GENERATION_KINDS = new Set(["letter", "visual_memory"]);

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

  const job = await readAiGenerationJob(jobId);
  if (!job || job.generation_kind !== kind) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }
  if (kind === "letter") {
    const email = searchParams.get("email")?.trim() ?? "";
    const ownerHash = aiGenerationIdentityHash(email);
    if (!ownerHash || job.owner_identity_hash !== ownerHash) {
      return Response.json({ error: "Generation not found." }, { status: 404 });
    }
  }

  if (job.status === "succeeded" && job.result) {
    return Response.json({ status: "succeeded", jobId, result: job.result });
  }
  if (job.status === "failed") {
    return Response.json({
      status: "failed",
      jobId,
      error: "Generation could not be completed. Please try again.",
    });
  }
  return Response.json({
    status: job.status === "processing" ? "processing" : "queued",
    jobId,
  }, { headers: { "Retry-After": "3" } });
}
