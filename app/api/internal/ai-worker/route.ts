import {
  completeAiGeneration,
  claimAiGenerationJobs,
  requeueAiGenerationJob,
  readAiGenerationJob,
  type AiGenerationJob,
} from "@/lib/ai-generation-guard";
import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  generateSeasonalPolaroidImage,
  generateSeasonalPolaroidMemo,
} from "@/lib/seasonal-polaroid-ai";
import {
  parseSeasonalPolaroidQueuePayload,
} from "@/lib/seasonal-polaroid-admission";
import {
  validateSeasonalPolaroidRequest,
  type SeasonalPolaroidQuestionnaire,
} from "@/lib/seasonal-polaroid-contract";
import {
  resolveSeasonalPolaroidCostume,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidPromptAnswers,
} from "@/lib/seasonal-polaroid-prompts";
import { validateSeasonalPolaroidPhotoContent } from "@/lib/seasonal-polaroid-photo-server";
import {
  downloadSeasonalPolaroidResultImage,
  uploadSeasonalPolaroidResultImage,
} from "@/lib/seasonal-polaroid-result-storage";
import {
  finalizeSeasonalGuestTrial,
  releaseSeasonalGuestTrial,
} from "@/lib/seasonal-polaroid-guest-trial";

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

function safeReferenceName(value: string | undefined, fallback: string): string {
  const normalized = value?.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ?? "";
  return normalized || fallback;
}

function seasonalReservation(job: AiGenerationJob): { id: string; version: number } | null {
  const value = job.input_payload?.guestTrialReservationId;
  const version = job.input_payload?.guestTrialReservationVersion;
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    && typeof version === "number" && Number.isInteger(version) && version > 0
    ? { id: value, version }
    : null;
}

async function requeueSeasonalJob(job: AiGenerationJob, errorCode: string): Promise<void> {
  await requeueAiGenerationJob(job.idempotency_key, errorCode);
  const reservation = seasonalReservation(job);
  if (!reservation) return;
  const current = await readAiGenerationJob(job.idempotency_key);
  if (current?.status === "failed") await releaseSeasonalGuestTrial(reservation.id, reservation.version);
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

async function processSeasonalPolaroidJob(job: AiGenerationJob): Promise<void> {
  const payload = parseSeasonalPolaroidQueuePayload(job.input_payload, job.idempotency_key);
  if (!payload) {
    await requeueSeasonalJob(job, "invalid_seasonal_input");
    return;
  }
  const storage = createSupabaseServerClient();
  if (!storage) {
    await requeueSeasonalJob(job, "storage_unavailable");
    return;
  }

  const bucket = storage.storage.from("ai-generation-inputs");
  const primaryDownload = await bucket.download(payload.inputPhotos.primary);
  const secondaryDownload = payload.inputPhotos.secondary
    ? await bucket.download(payload.inputPhotos.secondary)
    : null;
  if (primaryDownload.error || !primaryDownload.data) {
    await requeueSeasonalJob(job, "seasonal_primary_download_failed");
    return;
  }
  if (payload.inputPhotos.secondary && (secondaryDownload?.error || !secondaryDownload?.data)) {
    await requeueSeasonalJob(job, "seasonal_secondary_download_failed");
    return;
  }

  const metadata = payload.photoMetadata;
  const primaryName = safeReferenceName(metadata?.primary.name, "pet-reference.jpg");
  const primaryType = metadata?.primary.contentType || "image/jpeg";
  const secondaryName = safeReferenceName(metadata?.secondary?.name, "pet-reference-2.jpg");
  const secondaryType = metadata?.secondary?.contentType || "image/jpeg";
  const primaryBytes = await primaryDownload.data.arrayBuffer();
  const secondaryBytes = secondaryDownload?.data ? await secondaryDownload.data.arrayBuffer() : undefined;
  const primaryPhoto = new File([primaryBytes], primaryName, { type: primaryType });
  const secondaryPhoto = secondaryBytes
    ? new File([secondaryBytes], secondaryName, { type: secondaryType })
    : undefined;
  const validated = validateSeasonalPolaroidRequest({
    answers: payload.answers as SeasonalPolaroidQuestionnaire,
    primaryPhoto,
    ...(secondaryPhoto ? { secondaryPhoto } : {}),
  });
  const primaryIssue = validateSeasonalPolaroidPhotoContent(
    primaryPhoto,
    new Uint8Array(primaryBytes),
    "primaryPhoto",
  );
  const secondaryIssue = secondaryPhoto && secondaryBytes
    ? validateSeasonalPolaroidPhotoContent(secondaryPhoto, new Uint8Array(secondaryBytes), "secondaryPhoto")
    : null;
  if (!validated.valid || primaryIssue || secondaryIssue) {
    await requeueSeasonalJob(job, "invalid_seasonal_input");
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    await requeueSeasonalJob(job, "openai_unavailable");
    return;
  }
  const promptAnswers = validated.answers as SeasonalPolaroidPromptAnswers;
  const openai = new OpenAI({ apiKey });
  // Image and memo generation use independent inputs. Start the memo while
  // the image model is working, but keep the job incomplete until both have
  // been validated and the image is safely stored.
  const memoPromise = generateSeasonalPolaroidMemo({
    openai,
    answers: promptAnswers,
  });
  // An image failure can finish the worker before the memo promise settles;
  // attach a rejection handler so bounded retry handling remains the only
  // observable outcome.
  void memoPromise.catch(() => undefined);

  const resultPath = payload.resultPath;
  const existingImage = await downloadSeasonalPolaroidResultImage({ storage, objectKey: resultPath });
  let imageBytes: ArrayBuffer;
  let imageModel = "stored-retry";
  let imageReferenceCount: 1 | 2 = secondaryPhoto ? 2 : 1;
  if (existingImage) {
    imageBytes = await existingImage.arrayBuffer();
  } else {
    const imageResult = await generateSeasonalPolaroidImage({
      openai,
      answers: validated.answers as SeasonalPolaroidPromptAnswers,
      primary: { bytes: primaryBytes, name: primaryName, type: primaryType },
      ...(secondaryBytes ? { secondary: { bytes: secondaryBytes, name: secondaryName, type: secondaryType } } : {}),
    });
    if (!imageResult.imageBase64) {
      await requeueSeasonalJob(job, "seasonal_image_failed");
      return;
    }
    const decoded = Buffer.from(imageResult.imageBase64, "base64");
    if (!decoded.byteLength) {
      await requeueSeasonalJob(job, "seasonal_image_invalid");
      return;
    }
    imageBytes = decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer;
    imageModel = imageResult.modelUsed;
    imageReferenceCount = imageResult.referenceCount;
    const uploaded = await uploadSeasonalPolaroidResultImage({ storage, objectKey: resultPath, bytes: imageBytes });
    if (!uploaded.ok) {
      await requeueSeasonalJob(job, uploaded.code);
      return;
    }
  }

  const memoResult = await memoPromise;
  if (!validateSeasonalPolaroidMemo(memoResult.memo, promptAnswers).valid) {
    await requeueSeasonalJob(job, "seasonal_memo_invalid");
    return;
  }
  const resultId = randomUUID();
  const result = {
    resultId,
    image: { kind: "private-object", objectKey: resultPath, mimeType: "image/jpeg" },
    memo: memoResult.memo,
    themeId: validated.answers.themeId,
    costumeId: resolveSeasonalPolaroidCostume(promptAnswers),
    pet: {
      name: promptAnswers.petName,
      species: promptAnswers.species,
      status: promptAnswers.status,
    },
    generation: {
      themeId: validated.answers.themeId,
      imageModel,
      textModel: memoResult.modelUsed,
      generatedAt: new Date().toISOString(),
      referenceCount: imageReferenceCount,
      memoFallback: memoResult.fallback,
    },
    // Seasonal authenticated saving is a later phase; do not mint a proof
    // that existing letter/Visual Memory save endpoints would accept.
    saveProof: null,
  };
  await completeAiGeneration("seasonal_polaroid", job.request_hash, result);
  const reservation = seasonalReservation(job);
  if (reservation && !(await finalizeSeasonalGuestTrial(reservation.id, reservation.version))) {
    console.error("[ai-worker] Seasonal guest trial finalization pending", { jobId: job.idempotency_key });
  }
}

async function processJob(job: AiGenerationJob, baseUrl: string): Promise<void> {
  try {
    switch (job.generation_kind) {
      case "letter":
        await processLetterJob(job, baseUrl);
        return;
      case "visual_memory":
        await processVisualMemoryJob(job, baseUrl);
        return;
      case "seasonal_polaroid":
        await processSeasonalPolaroidJob(job);
        return;
      default:
        // Keep runtime safety even if a future database value is returned
        // before this worker's type definitions are updated.
        await requeueAiGenerationJob(job.idempotency_key, "unsupported_generation_kind");
    }
  } catch (error) {
    console.error("[ai-worker] job execution failed", {
      kind: job.generation_kind,
      jobId: job.idempotency_key,
      error: error instanceof Error ? error.message : "unknown",
    });
    await requeueAiGenerationJob(job.idempotency_key, "worker_exception");
    if (job.generation_kind === "seasonal_polaroid") {
      const reservation = seasonalReservation(job);
      const current = await readAiGenerationJob(job.idempotency_key);
      if (reservation && current?.status === "failed") await releaseSeasonalGuestTrial(reservation.id, reservation.version);
    }
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
