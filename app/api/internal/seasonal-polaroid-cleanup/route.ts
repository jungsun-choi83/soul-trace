import { createSupabaseServerClient } from "@/lib/supabase-server";
import { parseSeasonalPolaroidQueuePayload } from "@/lib/seasonal-polaroid-admission";
import { runSeasonalPolaroidCleanup } from "@/lib/seasonal-polaroid-cleanup-runner";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

async function requestedDryRun(request: Request): Promise<boolean> {
  try {
    const body = await request.json() as { dryRun?: unknown };
    return body.dryRun !== false;
  } catch {
    return true;
  }
}

/**
 * Internal, fail-closed cleanup endpoint. It is not scheduled by this phase:
 * Supabase Cron wiring requires an approved retention policy and Vault setup.
 * Even when explicitly requested, deletion requires a separate server-side
 * flag and can never remove result objects.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Not found." }, { status: 404 });
  const db = createSupabaseServerClient();
  if (!db) return Response.json({ error: "Cleanup unavailable." }, { status: 503 });

  const requested = await requestedDryRun(request);
  const deletionEnabled = process.env.SOUL_TRACE_SEASONAL_CLEANUP_DELETE_ENABLED === "true";
  try {
    const report = await runSeasonalPolaroidCleanup({
      db,
      parsePayload: (value, jobId) => {
        const payload = parseSeasonalPolaroidQueuePayload(value, jobId);
        if (!payload) return null;
        const match = payload.inputPhotos.primary.match(
          new RegExp(`^seasonal-polaroid/${jobId.toLowerCase()}/inputs/([A-Za-z0-9_-]{16,64})/primary\\.input$`, "i"),
        );
        if (!match?.[1]) return null;
        return {
          inputPhotos: {
            attemptId: match[1],
            primary: payload.inputPhotos.primary,
            secondary: payload.inputPhotos.secondary,
          },
          resultPath: payload.resultPath,
        };
      },
      dryRun: requested,
      deletionEnabled,
    });
    return Response.json(report, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Cleanup unavailable." }, { status: 503 });
  }
}
