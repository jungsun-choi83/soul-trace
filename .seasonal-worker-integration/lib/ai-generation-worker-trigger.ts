import "server-only";

import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const JOB_ID_PATTERN = /^[a-f0-9]{64}$/i;

/**
 * Wake the worker after the durable queue write has completed. `after()` lets
 * the API response reach the browser without awaiting this best-effort call;
 * the Cron worker remains the recovery path if Vercel cannot run it.
 */
export function scheduleAiGenerationWorker(
  request: Request,
  options: { queuedKnown?: boolean } = {},
): void {
  const secret = process.env.AI_GENERATION_WORKER_SECRET?.trim();
  if (!secret) return;

  // Internal worker calls already have a lease and are handled by the worker's
  // bounded continuation loop. Suppressing triggers here prevents recursion.
  const workerJobId = request.headers.get("x-soul-trace-ai-job-id")?.trim() ?? "";
  if (
    request.headers.get("x-soul-trace-ai-worker-token") === secret &&
    JOB_ID_PATTERN.test(workerJobId)
  ) return;

  let origin: string;
  try {
    origin = new URL(request.url).origin;
  } catch {
    return;
  }

  try {
    after(async () => {
      try {
        if (!options.queuedKnown) {
          const supabase = createSupabaseServerClient();
          if (!supabase) return;
          const { data, error } = await supabase
            .from("ai_generation_jobs")
            .select("idempotency_key")
            .eq("status", "queued")
            .eq("input_ready", true)
            .order("created_at", { ascending: true })
            .limit(1);
          // A failed probe is deliberately a no-op; Cron remains the recovery
          // path and this avoids an unbounded trigger storm during a DB outage.
          if (error || !data?.length) return;
        }
        const response = await fetch(`${origin}/api/internal/ai-worker`, {
          method: "POST",
          headers: {
            "x-soul-trace-ai-worker-token": secret,
          },
          cache: "no-store",
        });
        if (!response.ok && response.status !== 404) {
          console.warn("[ai-generation-trigger] worker wake returned non-success", {
            status: response.status,
          });
        }
      } catch (error) {
        // A missed wake is safe: the durable Cron worker will recover it.
        console.warn("[ai-generation-trigger] worker wake failed", {
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    });
  } catch (error) {
    // Calling after() outside an active request context must not affect the
    // generation response. Cron remains the recovery mechanism.
    console.warn("[ai-generation-trigger] could not schedule worker wake", {
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
