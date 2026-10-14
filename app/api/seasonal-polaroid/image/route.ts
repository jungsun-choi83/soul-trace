import { readAiGenerationJob } from "@/lib/ai-generation-guard";
import {
  seasonalPolaroidCapabilityMatches,
  seasonalPolaroidImageAccessTokenMatches,
} from "@/lib/seasonal-polaroid-capability";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import {
  seasonalPolaroidAccessAllowed,
  seasonalPolaroidDeveloperRequestAllowed,
} from "@/lib/seasonal-polaroid-access";
import {
  downloadSeasonalPolaroidResultImage,
  isSeasonalPolaroidResultPath,
} from "@/lib/seasonal-polaroid-result-storage";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";

export const runtime = "nodejs";
export const maxDuration = 20;

function notFound(): Response {
  return Response.json(
    { error: "Generation not found." },
    {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

/**
 * Authenticated private-image proxy. The browser sends short-lived delivery
 * and stable job capabilities in headers; no Supabase URL or object key is
 * placed in markup, query strings, or public storage.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isSeasonalPolaroidEnabled()) return notFound();
  if (!(await seasonalPolaroidAccessAllowed(request))) return notFound();
  if (!seasonalPolaroidDeveloperRequestAllowed(request)) {
    const auth = await createSupabaseAuthServerClient();
    const user = auth ? (await auth.auth.getUser()).data.user : null;
    if (!user) return notFound();
  }
  const jobId = new URL(request.url).searchParams.get("jobId")?.trim().toLowerCase() ?? "";
  if (!/^[a-f0-9]{64}$/.test(jobId)) return notFound();
  const capability = request.headers.get("x-soul-trace-seasonal-capability")?.trim() ?? "";
  const imageToken = request.headers.get("x-soul-trace-seasonal-image-token")?.trim() ?? "";
  const job = await readAiGenerationJob(jobId);
  if (
    !job ||
    job.generation_kind !== "seasonal_polaroid" ||
    !seasonalPolaroidCapabilityMatches(capability, jobId, job.request_hash) ||
    !seasonalPolaroidImageAccessTokenMatches(imageToken, jobId, job.request_hash) ||
    job.status !== "succeeded" ||
    !job.result ||
    !job.result.image || typeof job.result.image !== "object"
  ) return notFound();

  const image = job.result.image as Record<string, unknown>;
  if (image.kind !== "private-object" || typeof image.objectKey !== "string" || !isSeasonalPolaroidResultPath(jobId, image.objectKey)) return notFound();
  const storage = createSupabaseServerClient();
  if (!storage) return notFound();
  const blob = await downloadSeasonalPolaroidResultImage({
    storage,
    objectKey: image.objectKey,
  });
  if (!blob) return notFound();
  return new Response(blob, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
