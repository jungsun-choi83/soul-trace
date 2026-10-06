import {
  claimAiGenerationJobs,
  requeueAiGenerationJob,
  type AiGenerationJob,
} from "@/lib/ai-generation-guard";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
// One cron invocation claims at most the configured worker capacity. The OpenAI
// calls themselves have shorter explicit timeouts than this platform ceiling.
export const maxDuration = 240;

// Keep continuation bounded below the platform ceiling. A later Cron tick can
// recover anything left behind by a timeout or a failed invocation.
const WORKER_MAX_ROUNDS = 4;
const WORKER_EXECUTION_BUDGET_MS = 220_000;
const WORKER_MIN_REMAINING_MS = 15_000;

function isAuthorized(request: Request): boolean {
  const authorization = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;
  const workerSecret = process.env.AI_GENERATION_WORKER_SECRET?.trim();
  return Boolean(
    workerSecret &&
    request.headers.get("x-soul-trace-ai-worker-token") === workerSecret,
  );
}

function workerBaseUrl(request: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
}

async function processLetterJob(job: AiGenerationJob, baseUrl: string): Promise<void> {
  if (!job.input_payload) {
    await requeueAiGenerationJob(job.idempotency_key, "missing_letter_input");
    return;
  }
  const response = await fetch(`${baseUrl}/api/generate-letter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-soul-trace-ai-worker-token": process.env.AI_GENERATION_WORKER_SECRET ?? "",
      "x-soul-trace-ai-job-id": job.idempotency_key,
    },
    body: JSON.stringify(job.input_payload),
    cache: "no-store",
  });
  const body = await response.text();
  // A streaming route settles the durable job before its final SSE frame. A
  // response-level failure means the worker should use the bounded retry path.
  if (!response.ok || body.includes('"type":"error"') || body.includes('"type": "error"')) {
    await requeueAiGenerationJob(job.idempotency_key, `letter_worker_http_${response.status}`);
  }
}

async function processVisualMemoryJob(job: AiGenerationJob, baseUrl: string): Promise<void> {
  if (!job.input_payload || !job.input_storage_path) {
    await requeueAiGenerationJob(job.idempotency_key, "missing_visual_input");
    return;
  }
  const storage = createSupabaseServerClient();
  if (!storage) {
    await requeueAiGenerationJob(job.idempotency_key, "storage_unavailable");
    return;
  }
  const downloaded = await storage.storage.from("ai-generation-inputs").download(job.input_storage_path);
  if (downloaded.error || !downloaded.data) {
    await requeueAiGenerationJob(job.idempotency_key, "visual_input_download_failed");
    return;
  }
  const payload = job.input_payload;
  const formData = new FormData();
  const photoName = typeof payload.photoName === "string" ? payload.photoName : "pet-reference.jpg";
  const photoType = typeof payload.photoType === "string" ? payload.photoType : "image/jpeg";
  formData.append("photo", new File([await downloaded.data.arrayBuffer()], photoName, { type: photoType }));
  for (const key of [
    "selectedSceneId", "memoryDetail", "customSceneDescription", "mode",
    "petName", "petType", "breed", "generationNonce",
  ]) {
    const value = payload[key];
    if (typeof value === "string" && value) formData.append(key, value);
  }
  const response = await fetch(`${baseUrl}/api/visual-memory`, {
    method: "POST",
    headers: {
      "x-soul-trace-ai-worker-token": process.env.AI_GENERATION_WORKER_SECRET ?? "",
      "x-soul-trace-ai-job-id": job.idempotency_key,
    },
    body: formData,
    cache: "no-store",
  });
  if (!response.ok) {
    await requeueAiGenerationJob(job.idempotency_key, `visual_worker_http_${response.status}`);
  }
}

async function processJob(job: AiGenerationJob, baseUrl: string): Promise<void> {
  try {
    if (job.generation_kind === "letter") {
      await processLetterJob(job, baseUrl);
    } else {
      await processVisualMemoryJob(job, baseUrl);
    }
  } catch (error) {
    console.error("[ai-worker] job execution failed", {
      kind: job.generation_kind,
      jobId: job.idempotency_key,
      error: error instanceof Error ? error.message : "unknown",
    });
    await requeueAiGenerationJob(job.idempotency_key, "worker_exception");
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return Response.json({ error: "Not found." }, { status: 404 });
  const workerStartedAt = Date.now();
  const baseUrl = workerBaseUrl(request);
  let claimedCount = 0;
  let completedCount = 0;
  let rounds = 0;

  while (
    rounds < WORKER_MAX_ROUNDS &&
    Date.now() - workerStartedAt < WORKER_EXECUTION_BUDGET_MS - WORKER_MIN_REMAINING_MS
  ) {
    rounds += 1;
    const jobs = await claimAiGenerationJobs();
    if (jobs.length === 0) break;
    claimedCount += jobs.length;
    const results = await Promise.allSettled(jobs.map((job) => processJob(job, baseUrl)));
    completedCount += results.filter((result) => result.status === "fulfilled").length;
  }

  return Response.json({
    claimed: claimedCount,
    completed: completedCount,
    rounds,
  });
}

export const POST = GET;
