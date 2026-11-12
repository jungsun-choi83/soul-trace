import { randomUUID } from "node:crypto";
import {
  admitSeasonalPolaroidInternally,
  seasonalPolaroidRequestHash,
} from "@/lib/seasonal-polaroid-admission";
import { aiGenerationIdentityHash, guardHttpResponse, sha256Hex } from "@/lib/ai-generation-guard";
import { validateSeasonalPolaroidRequest, type SeasonalPolaroidQuestionnaire } from "@/lib/seasonal-polaroid-contract";
import { issueSeasonalPolaroidCapability, seasonalPolaroidCapabilityConfigured } from "@/lib/seasonal-polaroid-capability";
import { isSeasonalPolaroidEnabled } from "@/lib/seasonal-polaroid-feature";
import { isPolaroidOccasionAdmitted, isPolaroidThemeAdmitted } from "@/lib/polaroid-theme-catalog";
import {
  seasonalPolaroidAccessAllowed,
  seasonalPolaroidDeveloperRequestAllowed,
} from "@/lib/seasonal-polaroid-access";
import {
  detectSeasonalPolaroidPhotoFormat,
  validateSeasonalPolaroidPhotoContent,
} from "@/lib/seasonal-polaroid-photo-server";
import { createSupabaseAuthServerClient } from "@/lib/supabase-auth-server";
import { requireOwnedPet } from "@/lib/pet-first-archive-server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 240;

// Explicit server-side activation control. The environment flag defaults to
// false, so local and production deployments remain disabled until reviewed.
const seasonalPolaroidGenerationEnabled = isSeasonalPolaroidEnabled();

function text(formData: FormData, key: string, maxLength: number): string {
  const value = formData.get(key);
  // Keep the complete value so the contract validator can reject overlong
  // input instead of silently turning it into an accepted truncated value.
  void maxLength;
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(formData: FormData, key: string, maxLength: number): string {
  return text(formData, key, maxLength);
}

function readPersonalities(formData: FormData): string[] {
  const values = formData.getAll("personalities").filter((value): value is string => typeof value === "string");
  if (values.length === 1) {
    try {
      const parsed: unknown = JSON.parse(values[0]!);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  }
  return values;
}

function readFile(formData: FormData, ...keys: string[]): File | undefined {
  for (const key of keys) {
    const value = formData.get(key);
    if (value && typeof value === "object" && typeof (value as File).arrayBuffer === "function") {
      return value as File;
    }
  }
  return undefined;
}

function hasNonFileValue(formData: FormData, ...keys: string[]): boolean {
  return keys.some((key) => formData.getAll(key).some((value) => typeof value === "string" && value.length > 0));
}

function hasRepeatedFile(formData: FormData, ...keys: string[]): boolean {
  return keys.reduce(
    (count, key) => count + formData.getAll(key).filter((value) => typeof value === "object").length,
    0,
  ) > 1;
}

function invalidRequest(issues: unknown[]) {
  return Response.json({ error: "invalid_request", issues }, { status: 400 });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function optionalSeasonalUserId(): Promise<string | null> {
  try {
    const auth = await createSupabaseAuthServerClient();
    const user = auth ? (await auth.auth.getUser()).data.user : null;
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function admissionResponse(
  decision: Awaited<ReturnType<typeof admitSeasonalPolaroidInternally>>,
  requestHash: string,
  petId: string | null,
): Response {
  if (!("jobId" in decision) || !decision.jobId) {
    return guardHttpResponse(decision as Exclude<typeof decision, { decision: "acquired" | "succeeded" }>);
  }
  const capability = issueSeasonalPolaroidCapability(decision.jobId, requestHash);
  if (!capability) {
    return Response.json(
      { error: "Generation is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
    );
  }
  if (decision.decision === "succeeded") {
    return Response.json(
      { status: "succeeded", jobId: decision.jobId, capability, trialRemaining: decision.trialRemaining, petId },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const status = decision.decision === "acquired"
    ? "processing"
    : decision.decision === "pending" ? "queued" : decision.decision;
  const retryAfter = "retryAfter" in decision ? decision.retryAfter : 1;
  return Response.json(
    { status, jobId: decision.jobId, capability, trialRemaining: decision.trialRemaining, petId },
    {
      status: 202,
      headers: {
        "Retry-After": String(Math.max(1, retryAfter)),
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  // The feature flag is checked before parsing or materializing photos. When
  // controlled test mode is enabled, the additional access gate is also
  // evaluated before admission.
  if (!seasonalPolaroidGenerationEnabled) {
    return Response.json(
      {
        error: "seasonal_polaroid_unavailable",
        message: "Seasonal Polaroid generation is not available yet.",
      },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }
  if (!(await seasonalPolaroidAccessAllowed(request))) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }

  // Normal Seasonal generation requires a real Supabase session established
  // by the OTP flow. The localhost-only developer mode remains the explicit
  // exception so local testing does not require a customer account.
  const developerTestMode = seasonalPolaroidDeveloperRequestAllowed(request);
  let authenticatedUserId: string | null = null;
  if (developerTestMode) {
    authenticatedUserId = await optionalSeasonalUserId();
  } else {
    const auth = await createSupabaseAuthServerClient();
    const user = auth ? (await auth.auth.getUser()).data.user : null;
    if (!user) {
      return Response.json(
        { error: "authentication_required" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    authenticatedUserId = user.id;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return invalidRequest([{ field: "request", code: "invalid_form_data" }]);
  }

  // The request ID is untrusted input. Only a server-side ownership lookup can
  // bind a Pet-First result; general/guest Polaroids keep a null association.
  const requestedPetId = text(formData, "petId", 64).trim();
  let selectedPetId: string | null = null;
  let selectedPet: { pet_name: string; species?: string | null; life_status?: string | null } | null = null;
  if (requestedPetId) {
    const access = await requireOwnedPet(requestedPetId);
    if (!access.ok) return access.response;
    if (!authenticatedUserId || access.user.id !== authenticatedUserId) {
      return Response.json({ error: "pet_unavailable" }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    selectedPetId = access.pet.pet_id;
    selectedPet = access.pet;

    // Do not queue paid work that an older completion RPC could persist
    // without its Pet ID. The additive migration installs the column and the
    // matching transactional completion logic together.
    const db = createSupabaseServerClient();
    if (!db) return Response.json({ error: "pet_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const petLinkSchema = await db.from("seasonal_polaroid_results").select("pet_id").limit(0);
    if (petLinkSchema.error) return Response.json({ error: "pet_polaroid_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const primaryPhoto = readFile(formData, "primaryPhoto", "photo");
  if (hasRepeatedFile(formData, "primaryPhoto", "photo")) {
    return invalidRequest([{ field: "primaryPhoto", code: "too_many" }]);
  }
  if (hasNonFileValue(formData, "primaryPhoto", "photo")) {
    return invalidRequest([{ field: "primaryPhoto", code: "photo_required" }]);
  }
  const answers: SeasonalPolaroidQuestionnaire = {
    themeId: text(formData, "themeId", 32),
    occasionId: optionalText(formData, "occasionId", 64),
    locale: text(formData, "locale", 8),
    petName: text(formData, "petName", 12),
    species: text(formData, "species", 32),
    status: text(formData, "status", 32),
    costume: text(formData, "costume", 64),
    scene: text(formData, "scene", 64),
    vibe: text(formData, "vibe", 64),
    personalities: readPersonalities(formData),
    habit: text(formData, "habit", 64),
    customHabit: optionalText(formData, "customHabit", 60),
    favoriteTreat: text(formData, "favoriteTreat", 64),
    customTreat: optionalText(formData, "customTreat", 60),
    callName: text(formData, "callName", 64),
    customCallName: optionalText(formData, "customCallName", 40),
    personalDetail: optionalText(formData, "personalDetail", 60),
    generationNonce: optionalText(formData, "generationNonce", 128),
  };
  if (selectedPet) {
    // Canonical identity/status always come from the owned pet row. Missing
    // legacy profile fields remain questionnaire answers and are never saved
    // back to the pet profile.
    answers.petName = selectedPet.pet_name.slice(0, 12);
    if (typeof selectedPet.species === "string" && ["dog", "cat", "rabbit", "hamster", "bird", "other"].includes(selectedPet.species)) {
      answers.species = selectedPet.species;
    }
    if (selectedPet.life_status === "living") answers.status = "living";
    if (selectedPet.life_status === "memorial") answers.status = "passed";
  }

  // Only the primary photo is read; any extra file fields are ignored.
  const validation = validateSeasonalPolaroidRequest({ answers, primaryPhoto: primaryPhoto! });
  if (!validation.valid) return invalidRequest(validation.issues);
  if (!isPolaroidThemeAdmitted(String(validation.answers.themeId))) {
    return invalidRequest([{ field: "themeId", code: "unsupported" }]);
  }
  if (validation.answers.occasionId && !isPolaroidOccasionAdmitted(String(validation.answers.occasionId))) {
    return invalidRequest([{ field: "occasionId", code: "unsupported" }]);
  }

  let primaryBytes: Uint8Array;
  try {
    primaryBytes = new Uint8Array(await primaryPhoto!.arrayBuffer());
  } catch {
    return invalidRequest([{ field: "primaryPhoto", code: "photo_signature" }]);
  }
  const photoIssues = [
    validateSeasonalPolaroidPhotoContent(primaryPhoto!, primaryBytes, "primaryPhoto"),
  ].filter((issue): issue is NonNullable<typeof issue> => Boolean(issue));
  if (photoIssues.length) return invalidRequest(photoIssues);

  const baseRequestHash = await seasonalPolaroidRequestHash({
    answers: validation.answers,
    primaryBytes,
    petId: selectedPetId,
  });
  // A local developer submission gets its own idempotency namespace. This
  // prevents it from reusing a customer's job while keeping normal retries
  // and customer idempotency unchanged outside developer mode.
  const requestHash = developerTestMode
    ? await sha256Hex(`seasonal-developer:${randomUUID()}:${baseRequestHash}`)
    : baseRequestHash;

  if (!seasonalPolaroidCapabilityConfigured()) {
    return Response.json(
      { error: "seasonal_polaroid_unavailable" },
      { status: 503, headers: { "Retry-After": "30" } },
    );
  }

  // The allowance is keyed to the same verified-user HMAC used for queue
  // ownership, never to a browser cookie. Developer mode is the only local
  // exception and deliberately has no customer trial identity.
  const accountHash = authenticatedUserId ? aiGenerationIdentityHash(authenticatedUserId) : null;
  if (!developerTestMode && !accountHash) {
    return Response.json(
      { error: "seasonal_polaroid_unavailable", message: "Account generation is temporarily unavailable." },
      { status: 503, headers: { "Retry-After": "30", "Cache-Control": "no-store" } },
    );
  }

  const decision = await admitSeasonalPolaroidInternally({
    request,
    answers: validation.answers,
    requestHash,
    primary: {
      bytes: toArrayBuffer(primaryBytes),
      contentType: detectSeasonalPolaroidPhotoFormat(primaryBytes)!,
      name: primaryPhoto!.name || "pet-reference.jpg",
    },
    ...(accountHash ? { accountHash } : {}),
    identity: authenticatedUserId,
    petId: selectedPetId,
    developerTestMode,
  });
  if (["unavailable", "rate_limited", "busy", "conflict", "guest_trial_exhausted"].includes(decision.decision)) {
    return guardHttpResponse(decision as Exclude<typeof decision, { decision: "acquired" | "succeeded" }>);
  }
  return admissionResponse(decision, requestHash, selectedPetId);
}
