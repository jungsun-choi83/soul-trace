import assert from "node:assert/strict";
import { register } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { fallbackSeasonalPolaroidMemo, type SeasonalPolaroidPromptAnswers } from "./seasonal-polaroid-prompts.ts";

/**
 * Drives the real Seasonal worker route end to end with every external
 * dependency (queue, Supabase storage, OpenAI, persistence, trials) replaced
 * by in-memory doubles. No network, no database, no paid API.
 *
 * What this proves: the image is generated at most once per job, a stored
 * image is reused on every caption retry or re-claim, the caption request
 * carries that image, and a caption or persistence failure requeues without
 * completing or spending another image generation.
 */
type Mocks = {
  jobs: unknown[];
  claims: number;
  requeues: Array<{ key: string; code: string }>;
  jobStatus: string;
  storedImage: Uint8Array | null;
  downloads: number;
  inputDownloads: string[];
  uploads: number;
  imageCalls: number;
  imageBase64: string | null;
  memoCalls: Array<{ image?: { base64: string; mimeType: string } }>;
  memoLines: string[] | null;
  completions: Array<Record<string, unknown>>;
  completeOk: boolean;
  finalized: number;
  released: number;
};
const mocks: Mocks = {
  jobs: [], claims: 0, requeues: [], jobStatus: "queued", storedImage: null, downloads: 0, inputDownloads: [], uploads: 0,
  imageCalls: 0, imageBase64: null, memoCalls: [], memoLines: null, completions: [], completeOk: true,
  finalized: 0, released: 0,
};
(globalThis as Record<string, unknown>).__seasonalWorkerMocks = mocks;

const dataModule = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
const realModule = (file: string) => pathToFileURL(resolve(process.cwd(), file)).href;
const M = "globalThis.__seasonalWorkerMocks";
const stubs: Record<string, string> = {
  openai: dataModule(`export default class OpenAI { constructor() {} }`),
  "@/lib/ai-generation-guard": dataModule(`
    export async function claimAiGenerationJobs() { ${M}.claims += 1; return ${M}.jobs.splice(0); }
    export async function requeueAiGenerationJob(key, code) { ${M}.requeues.push({ key, code }); return true; }
    export async function readAiGenerationJob() { return { status: ${M}.jobStatus }; }
  `),
  "@/lib/supabase-server": dataModule(`
    export function createSupabaseServerClient() {
      return { storage: { from: () => ({ download: async (path) => { ${M}.inputDownloads.push(path); return { data: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])]), error: null }; } }) } };
    }
  `),
  "@/lib/seasonal-polaroid-ai": dataModule(`
    export async function generateSeasonalPolaroidImage() {
      ${M}.imageCalls += 1;
      return { imageBase64: ${M}.imageBase64, modelUsed: "gpt-image-2", usage: null, referenceCount: 1 };
    }
    export async function generateSeasonalPolaroidMemo({ image }) {
      ${M}.memoCalls.push({ image });
      return { memo: { locale: "en", lines: ${M}.memoLines }, modelUsed: "gpt-4o-mini", retried: false, fallback: false, vision: Boolean(image), attempts: 1, firstAttemptValid: true, failureCodes: [], usage: null };
    }
  `),
  "@/lib/seasonal-polaroid-admission": dataModule(`export function parseSeasonalPolaroidQueuePayload(value) { return value; }`),
  "@/lib/seasonal-polaroid-photo-server": dataModule(`export function validateSeasonalPolaroidPhotoContent() { return null; }`),
  "@/lib/seasonal-polaroid-result-storage": dataModule(`
    export async function downloadSeasonalPolaroidResultImage() {
      ${M}.downloads += 1;
      return ${M}.storedImage ? new Blob([${M}.storedImage]) : null;
    }
    export async function uploadSeasonalPolaroidResultImage({ bytes }) {
      ${M}.uploads += 1; ${M}.storedImage = new Uint8Array(bytes); return { ok: true };
    }
  `),
  "@/lib/seasonal-polaroid-guest-trial": dataModule(`
    export async function finalizeSeasonalGuestTrial() { ${M}.finalized += 1; return true; }
    export async function releaseSeasonalGuestTrial() { ${M}.released += 1; return true; }
  `),
  "@/lib/seasonal-polaroid-persistence": dataModule(`
    export async function completeSeasonalPolaroidJob(hash, result) { ${M}.completions.push(result); return ${M}.completeOk; }
  `),
  "@/lib/seasonal-polaroid-contract": realModule("lib/seasonal-polaroid-contract.ts"),
  "@/lib/seasonal-polaroid-prompts": realModule("lib/seasonal-polaroid-prompts.ts"),
};
const loader = `
  const stubs = ${JSON.stringify(stubs)};
  export async function resolve(specifier, context, nextResolve) {
    if (stubs[specifier]) return { url: stubs[specifier], shortCircuit: true };
    return nextResolve(specifier, context);
  }
`;
register(dataModule(loader), import.meta.url);
process.env.CRON_SECRET = "test-cron-secret";
process.env.OPENAI_API_KEY = "sk-test-not-used";
const { GET } = await import("../app/api/internal/ai-worker/route.ts");

const JOB_ID = "a".repeat(64);
const ATTEMPT = "attempt_0123456789abcdef";
const ANSWERS: SeasonalPolaroidPromptAnswers = {
  themeId: "halloween",
  locale: "en",
  petName: "Juju",
  species: "dog",
  status: "living",
  costume: "skeleton",
  scene: "trick-or-treat-street",
  vibe: "cute-cozy",
  personalities: ["cuddle-bug"],
  habit: "toy-carrier",
  favoriteTreat: "cheese",
  customTreat: "",
  callName: "mom",
  customCallName: "",
  personalDetail: "",
  generationNonce: "",
};
const RESULT_PATH = `seasonal-polaroid/${JOB_ID}/result/${ATTEMPT}.jpg`;
const GENERATED_IMAGE = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 8, 7, 6, 5]);

function job() {
  return {
    idempotency_key: JOB_ID,
    request_hash: "b".repeat(64),
    generation_kind: "seasonal_polaroid",
    status: "processing",
    result: null,
    error_code: null,
    attempt_count: 1,
    lease_expires_at: null,
    created_at: "2026-10-29T00:00:00.000Z",
    updated_at: "2026-10-29T00:00:00.000Z",
    completed_at: null,
    input_ready: true,
    input_payload: {
      version: 1,
      themeId: "halloween",
      locale: "en",
      resultPath: RESULT_PATH,
      inputPhotos: { primary: `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT}/primary.input`, secondary: null },
      photoMetadata: { primary: { name: "juju.jpg", contentType: "image/jpeg" }, secondary: null },
      answers: ANSWERS,
      guestTrialReservationId: "123e4567-e89b-42d3-a456-426614174000",
      guestTrialReservationVersion: 1,
    },
  };
}

function reset(overrides: Partial<Mocks> = {}) {
  Object.assign(mocks, {
    jobs: [job()], claims: 0, requeues: [], jobStatus: "queued", storedImage: null, downloads: 0, inputDownloads: [], uploads: 0,
    imageCalls: 0, imageBase64: Buffer.from(GENERATED_IMAGE).toString("base64"), memoCalls: [],
    memoLines: fallbackSeasonalPolaroidMemo(ANSWERS).lines, completions: [], completeOk: true, finalized: 0, released: 0,
  }, overrides);
}

async function runWorker() {
  const response = await GET(new Request("https://worker.test/api/internal/ai-worker", {
    headers: { authorization: "Bearer test-cron-secret" },
  }));
  return response.json() as Promise<{ claimed: number; completed: number }>;
}

test("fresh job: image generated once, stored, then captioned from that exact image", async () => {
  reset();
  const summary = await runWorker();
  assert.equal(summary.claimed, 1);
  assert.equal(mocks.imageCalls, 1);
  assert.equal(mocks.uploads, 1);
  assert.equal(mocks.memoCalls.length, 1, "caption requested exactly once, after the image");
  assert.deepEqual(mocks.memoCalls[0]!.image, {
    base64: Buffer.from(GENERATED_IMAGE).toString("base64"),
    mimeType: "image/jpeg",
  });
  assert.equal(mocks.completions.length, 1);
  const result = mocks.completions[0] as { generation: Record<string, unknown>; memo: { lines: string[] }; image: Record<string, unknown> };
  assert.equal(result.generation.memoVision, true);
  assert.equal(result.generation.memoFallback, false);
  assert.equal(result.generation.memoAttempts, 1);
  assert.equal(result.generation.memoFirstAttemptValid, true);
  assert.deepEqual(result.generation.memoFailureCodes, []);
  assert.equal(result.generation.imageModel, "gpt-image-2");
  assert.deepEqual(result.memo.lines, mocks.memoLines);
  assert.deepEqual(result.image, { kind: "private-object", objectKey: RESULT_PATH, mimeType: "image/jpeg" });
  assert.equal(mocks.finalized, 1, "trial finalized once on completion");
  assert.deepEqual(mocks.requeues, []);
});

test("a legacy two-photo job is generated from its primary photo only", async () => {
  const legacy = job() as { input_payload: { inputPhotos: Record<string, unknown>; photoMetadata: Record<string, unknown> } };
  legacy.input_payload.inputPhotos.secondary = `seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT}/secondary.input`;
  legacy.input_payload.photoMetadata.secondary = { name: "juju-2.jpg", contentType: "image/jpeg" };
  reset({ jobs: [legacy] });
  const summary = await runWorker();
  assert.equal(summary.claimed, 1);
  assert.deepEqual(mocks.inputDownloads, [`seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT}/primary.input`], "the second upload is never downloaded");
  assert.equal(mocks.imageCalls, 1);
  assert.equal(mocks.completions.length, 1);
  const result = mocks.completions[0] as { generation: Record<string, unknown> };
  assert.equal(result.generation.referenceCount, 1);
  assert.deepEqual(mocks.requeues, []);
});

test("fresh job downloads exactly the primary photo", async () => {
  reset();
  await runWorker();
  assert.deepEqual(mocks.inputDownloads, [`seasonal-polaroid/${JOB_ID}/inputs/${ATTEMPT}/primary.input`]);
});

test("re-claimed job with a stored image never regenerates the image", async () => {
  reset({ storedImage: GENERATED_IMAGE });
  await runWorker();
  assert.equal(mocks.imageCalls, 0);
  assert.equal(mocks.uploads, 0);
  assert.equal(mocks.memoCalls.length, 1);
  assert.equal(mocks.memoCalls[0]!.image!.base64, Buffer.from(GENERATED_IMAGE).toString("base64"));
  const result = mocks.completions[0] as { generation: Record<string, unknown> };
  assert.equal(result.generation.imageModel, "stored-retry");
  assert.equal(mocks.finalized, 1);
});

test("invalid caption requeues without completing; the retry reuses the stored image", async () => {
  reset({ memoLines: ["Mom, happy Halloween from Juju!", "I'm wearing a skeleton look,", "and my toy is close by.", "Hold me near and keep smiling with me."] });
  await runWorker();
  assert.equal(mocks.imageCalls, 1);
  assert.equal(mocks.uploads, 1);
  assert.deepEqual(mocks.requeues, [{ key: JOB_ID, code: "seasonal_memo_invalid" }]);
  assert.equal(mocks.completions.length, 0);
  assert.equal(mocks.finalized, 0, "no trial is finalized for an incomplete job");
  assert.equal(mocks.released, 0, "a requeued (not failed) job keeps its reservation");

  // Second claim of the same job, as after a requeue or a worker restart.
  mocks.jobs = [job()];
  mocks.memoLines = fallbackSeasonalPolaroidMemo(ANSWERS).lines;
  await runWorker();
  assert.equal(mocks.imageCalls, 1, "image was not generated again");
  assert.equal(mocks.uploads, 1);
  assert.equal(mocks.memoCalls.length, 2);
  assert.equal(mocks.completions.length, 1);
  assert.equal(mocks.finalized, 1);
});

test("image failure requeues before any caption call", async () => {
  reset({ imageBase64: null });
  await runWorker();
  assert.equal(mocks.imageCalls, 1);
  assert.equal(mocks.uploads, 0);
  assert.equal(mocks.memoCalls.length, 0);
  assert.deepEqual(mocks.requeues, [{ key: JOB_ID, code: "seasonal_image_failed" }]);
  assert.equal(mocks.completions.length, 0);
});

test("persistence failure requeues and the retry reuses the stored image", async () => {
  reset({ completeOk: false });
  await runWorker();
  assert.deepEqual(mocks.requeues, [{ key: JOB_ID, code: "seasonal_result_persistence_failed" }]);
  assert.equal(mocks.finalized, 0);
  mocks.jobs = [job()];
  mocks.completeOk = true;
  await runWorker();
  assert.equal(mocks.imageCalls, 1);
  assert.equal(mocks.completions.length, 2, "completion is attempted again with the same stored image");
  assert.equal((mocks.completions[1] as { image: { objectKey: string } }).image.objectKey, RESULT_PATH);
});

test("final failure releases the guest trial reservation", async () => {
  reset({ imageBase64: null, jobStatus: "failed" });
  await runWorker();
  assert.equal(mocks.released, 1);
  assert.equal(mocks.finalized, 0);
});
