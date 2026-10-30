import type {
  SeasonalPolaroidQuestionnaire,
  SeasonalPolaroidResult,
} from "@/lib/seasonal-polaroid-contract";

export const SEASONAL_POLAROID_SESSION_KEY = "soul-trace-seasonal-polaroid-generation";
export const SEASONAL_POLAROID_KIND = "seasonal_polaroid" as const;

export type SeasonalPolaroidJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type SeasonalPolaroidGenerationSession = {
  jobId: string;
  capability: string;
  locale: "ko" | "en";
  petName: string;
  pendingAction?: "save" | "download";
};

export type SeasonalPolaroidAdmissionResponse = {
  status: SeasonalPolaroidJobStatus;
  jobId: string;
  capability: string;
  trialRemaining?: number;
};

export type SeasonalPolaroidTrialResponse = { limit: number | "unlimited"; remaining: number | null; developer?: boolean };

export type SeasonalPolaroidPreviewResult = Omit<SeasonalPolaroidResult, "image"> & {
  image: {
    kind: "private-proxy";
    endpoint: string;
    mimeType: "image/jpeg" | "image/png";
    accessToken: string;
  };
};

export type SeasonalPolaroidStatusResponse =
  | { status: "queued" | "processing"; jobId: string }
  | { status: "failed"; jobId: string; error?: string }
  | { status: "succeeded"; jobId: string; result: SeasonalPolaroidPreviewResult };

export type SeasonalPolaroidAdmissionErrorCode = "rate_limited" | "busy" | "guest_trial_exhausted" | "unavailable" | "conflict" | "unknown";

export class SeasonalPolaroidRequestError extends Error {
  readonly status: number;
  readonly code: SeasonalPolaroidAdmissionErrorCode;
  readonly retryAfter: number | null;

  constructor(message: string, status: number, code: SeasonalPolaroidAdmissionErrorCode, retryAfter: number | null) {
    super(message);
    this.name = "SeasonalPolaroidRequestError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function buildSeasonalPolaroidFormData(
  answers: SeasonalPolaroidQuestionnaire,
  primaryPhoto: File,
): FormData {
  const formData = new FormData();
  formData.append("primaryPhoto", primaryPhoto, primaryPhoto.name);

  formData.append("themeId", String(answers.themeId));
  formData.append("locale", String(answers.locale));
  formData.append("petName", answers.petName);
  formData.append("species", answers.species);
  formData.append("status", answers.status);
  formData.append("costume", answers.costume);
  formData.append("scene", answers.scene);
  formData.append("vibe", answers.vibe);
  formData.append("personalities", JSON.stringify(answers.personalities));
  formData.append("habit", answers.habit);
  formData.append("customHabit", answers.customHabit ?? "");
  formData.append("favoriteTreat", answers.favoriteTreat);
  formData.append("customTreat", answers.customTreat ?? "");
  formData.append("callName", answers.callName);
  formData.append("customCallName", answers.customCallName ?? "");
  formData.append("personalDetail", answers.personalDetail ?? "");
  if (answers.generationNonce) formData.append("generationNonce", answers.generationNonce);
  return formData;
}

function responseError(status: number, body: unknown): Error {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
  const message = typeof record?.message === "string"
    ? record.message
    : typeof record?.error === "string"
      ? record.error
      : `Seasonal Polaroid request failed (${status}).`;
  const rawCode = typeof record?.code === "string" ? record.code : "unknown";
  const code: SeasonalPolaroidAdmissionErrorCode = rawCode === "rate_limited" || rawCode === "busy" || rawCode === "guest_trial_exhausted" || rawCode === "unavailable" || rawCode === "conflict"
    ? rawCode
    : "unknown";
  const bodyRetryAfter = typeof record?.retryAfter === "number" && Number.isFinite(record.retryAfter)
    ? Math.max(1, Math.ceil(record.retryAfter))
    : null;
  return new SeasonalPolaroidRequestError(message, status, code, bodyRetryAfter);
}

async function jsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function admitSeasonalPolaroid(formData: FormData): Promise<SeasonalPolaroidAdmissionResponse> {
  const response = await fetch("/api/seasonal-polaroid", {
    method: "POST",
    body: formData,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const body = await jsonResponse(response);
  if (!response.ok) {
    const error = responseError(response.status, body);
    if (error instanceof SeasonalPolaroidRequestError && error.retryAfter === null) {
      const headerRetryAfter = Number(response.headers.get("Retry-After"));
      if (Number.isFinite(headerRetryAfter) && headerRetryAfter > 0) {
        throw new SeasonalPolaroidRequestError(error.message, error.status, error.code, Math.ceil(headerRetryAfter));
      }
    }
    throw error;
  }
  if (!body || typeof body !== "object") throw new Error("The generation response was not valid.");
  const value = body as Partial<SeasonalPolaroidAdmissionResponse>;
  if (
    typeof value.jobId !== "string" ||
    typeof value.capability !== "string" ||
    !["queued", "processing", "succeeded"].includes(String(value.status))
  ) throw new Error("The generation response was incomplete.");
  return value as SeasonalPolaroidAdmissionResponse;
}

export async function readSeasonalPolaroidTrial(signal?: AbortSignal): Promise<SeasonalPolaroidTrialResponse> {
  const response = await fetch("/api/seasonal-polaroid/trial", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  const body = await jsonResponse(response);
  if (!response.ok) throw responseError(response.status, body);
  if (!body || typeof body !== "object") throw new Error("The Polaroid trial status was not valid.");
  const value = body as Partial<SeasonalPolaroidTrialResponse>;
  const developerUnlimited = value.developer === true && value.limit === "unlimited" && value.remaining === null;
  if (!developerUnlimited && (!Number.isInteger(Number(value.limit)) || Number(value.limit) < 1
    || !Number.isInteger(Number(value.remaining))
    || Number(value.remaining) < 0 || Number(value.remaining) > Number(value.limit))) {
    throw new Error("The Polaroid trial status was incomplete.");
  }
  return {
    limit: developerUnlimited ? "unlimited" : Number(value.limit),
    remaining: developerUnlimited ? null : Number(value.remaining),
    ...(value.developer === true ? { developer: true } : {}),
  };
}

export async function readSeasonalPolaroidStatus(
  session: SeasonalPolaroidGenerationSession,
  signal?: AbortSignal,
): Promise<SeasonalPolaroidStatusResponse> {
  const params = new URLSearchParams({
    kind: SEASONAL_POLAROID_KIND,
    jobId: session.jobId,
  });
  const response = await fetch(`/api/ai-generation/status?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "x-soul-trace-seasonal-capability": session.capability,
    },
    signal,
    cache: "no-store",
  });
  const body = await jsonResponse(response);
  if (!response.ok) throw responseError(response.status, body);
  if (!body || typeof body !== "object") throw new Error("The generation status was not valid.");
  const value = body as Partial<SeasonalPolaroidStatusResponse>;
  if (!["queued", "processing", "succeeded", "failed"].includes(String(value.status))) {
    throw new Error("The generation status was incomplete.");
  }
  if (value.jobId !== session.jobId) throw new Error("The generation status did not match this session.");
  if (value.status === "succeeded" && (!value.result || typeof value.result !== "object")) {
    throw new Error("The completed generation result was incomplete.");
  }
  return value as SeasonalPolaroidStatusResponse;
}

export async function fetchSeasonalPolaroidImage(
  session: SeasonalPolaroidGenerationSession,
  accessToken: string,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({ jobId: session.jobId });
  const response = await fetch(`/api/seasonal-polaroid/image?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "image/jpeg,image/*",
      "x-soul-trace-seasonal-capability": session.capability,
      "x-soul-trace-seasonal-image-token": accessToken,
    },
    signal,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("The private Polaroid image could not be loaded.");
  const blob = await response.blob();
  if (!blob.size) throw new Error("The private Polaroid image was empty.");
  return URL.createObjectURL(blob);
}

export function saveSeasonalPolaroidSession(session: SeasonalPolaroidGenerationSession): void {
  try {
    window.sessionStorage.setItem(SEASONAL_POLAROID_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Session storage is optional; the current tab can continue polling.
  }
}

export function readSeasonalPolaroidSession(): SeasonalPolaroidGenerationSession | null {
  try {
    const raw = window.sessionStorage.getItem(SEASONAL_POLAROID_SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SeasonalPolaroidGenerationSession>;
    if (
      typeof value.jobId !== "string" ||
      typeof value.capability !== "string" ||
      !["ko", "en"].includes(String(value.locale)) ||
      typeof value.petName !== "string" ||
      (value.pendingAction !== undefined && value.pendingAction !== "save" && value.pendingAction !== "download")
    ) return null;
    return value as SeasonalPolaroidGenerationSession;
  } catch {
    return null;
  }
}

export function clearSeasonalPolaroidSession(): void {
  try {
    window.sessionStorage.removeItem(SEASONAL_POLAROID_SESSION_KEY);
  } catch {
    // Ignore blocked storage.
  }
}
