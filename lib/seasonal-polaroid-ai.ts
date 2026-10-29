import OpenAI from "openai";

import {
  OPENAI_CHAT_OPTIONS,
} from "./ai-generation-guard.ts";
import {
  generatePetReferenceImage,
  petIdentityPreservationPrompt,
  type PetImageReference,
  type VisualMemoryImageGenerationResult,
} from "./visual-memory-ai.ts";
import {
  buildSeasonalPolaroidImagePrompt,
  buildSeasonalPolaroidMemoMessages,
  buildSeasonalPolaroidMemoVisionMessages,
  fallbackSeasonalPolaroidMemo,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidMemoImage,
  type SeasonalPolaroidPromptAnswers,
} from "./seasonal-polaroid-prompts.ts";
import type { SeasonalPolaroidMemo } from "./seasonal-polaroid-contract.ts";

export type SeasonalPolaroidImageInput = {
  openai: OpenAI;
  answers: SeasonalPolaroidPromptAnswers;
  primary: PetImageReference;
};

export type SeasonalPolaroidImageGenerationResult = VisualMemoryImageGenerationResult & {
  referenceCount: 1;
};

/** The Polaroid is generated from the single primary photo. */
export async function generateSeasonalPolaroidImage({
  openai,
  answers,
  primary,
}: SeasonalPolaroidImageInput): Promise<SeasonalPolaroidImageGenerationResult> {
  const references = [primary];
  const result = await generatePetReferenceImage({
    openai,
    references,
    prompt: buildSeasonalPolaroidImagePrompt(answers, petIdentityPreservationPrompt()),
    size: "1024x1024",
    logLabel: "seasonal-polaroid",
  });
  return { ...result, referenceCount: 1 };
}

export type SeasonalPolaroidMemoInput = {
  openai: OpenAI;
  answers: SeasonalPolaroidPromptAnswers;
  /**
   * The finished Polaroid photo. When present the caption request is
   * multimodal so the words can match what is actually pictured. Omitted
   * only when no image exists (tests, or a text-only recovery path).
   */
  image?: SeasonalPolaroidMemoImage;
};

export type SeasonalPolaroidMemoGenerationResult = {
  memo: SeasonalPolaroidMemo;
  modelUsed: "gpt-4o-mini" | null;
  retried: boolean;
  fallback: boolean;
  /** True when the accepted caption was written with the generated image attached. */
  vision: boolean;
  /** Model calls made (1 or 2). Fallback results still report the calls that preceded them. */
  attempts: number;
  /** True only when the very first model reply passed validation. */
  firstAttemptValid: boolean;
  /** Allow-listed failure codes per failed attempt, in order. Never contains model or user text. */
  failureCodes: string[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
  } | null;
};

export type SeasonalMemoExecutionStage =
  | "preparing_request"
  | "api_call"
  | "response_received"
  | "response_parsing"
  | "validation";

const SAFE_MEMO_VALIDATION_REASONS = new Set([
  "memo_shape_or_locale",
  "memo_line_length",
  "memo_missing_call_name",
  "memo_missing_pet_name",
  "memo_wrong_locale",
  "memo_third_person",
  "memo_not_first_person",
  "memo_disconnected_lines",
  "memo_letter_style",
  "memo_owner_instruction",
  "memo_incomplete",
  "memo_memorial_language",
]);

class SeasonalMemoValidationError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    // Keep the exception message generic. The allowlisted reason is emitted
    // separately as a diagnostic and never includes model text.
    super("seasonal_memo_validation_failed");
    this.name = "Error";
    this.reason = reason;
  }
}

function safeMemoValidationReason(error: unknown): string | null {
  if (!(error instanceof SeasonalMemoValidationError)) return null;
  return SAFE_MEMO_VALIDATION_REASONS.has(error.reason) ? error.reason : null;
}

function parseMemo(
  content: string,
  answers: SeasonalPolaroidPromptAnswers,
  markStage?: (stage: SeasonalMemoExecutionStage) => void,
): SeasonalPolaroidMemo {
  markStage?.("response_parsing");
  const parsed: unknown = JSON.parse(content);
  markStage?.("validation");
  const validation = validateSeasonalPolaroidMemo(parsed, answers);
  if (!validation.valid) throw new SeasonalMemoValidationError(validation.reason);
  return validation.memo;
}

export type SeasonalMemoErrorCategory =
  | "schema_rejection"
  | "authentication"
  | "rate_limit"
  | "network"
  | "server"
  | "unknown";

export type SeasonalMemoErrorDiagnostics = {
  category: SeasonalMemoErrorCategory;
  status: number | null;
  code: string | null;
  param: string | null;
  errorClass: string;
};

const SAFE_ERROR_CLASSES = new Set([
  "APIError",
  "APIConnectionError",
  "APIConnectionTimeoutError",
  "APIUserAbortError",
  "AuthenticationError",
  "PermissionDeniedError",
  "RateLimitError",
  "InternalServerError",
  "BadRequestError",
  "Error",
]);
const SAFE_ERROR_PARAMS = new Set(["response_format", "model", "messages", "temperature"]);

function errorRecord(error: unknown): Record<string, unknown> | null {
  return typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
}

function safeErrorClass(error: unknown): string {
  const name = errorRecord(error)?.name;
  return typeof name === "string" && SAFE_ERROR_CLASSES.has(name) ? name : "UnknownError";
}

function safeErrorToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const sanitized = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 64);
  return sanitized || null;
}

/**
 * Classify an OpenAI failure without returning its message, request details,
 * headers, prompt, or any other potentially sensitive content.
 */
export function classifySeasonalMemoError(error: unknown): SeasonalMemoErrorDiagnostics {
  const record = errorRecord(error);
  const status = typeof record?.status === "number" && Number.isInteger(record.status)
    ? record.status
    : null;
  const code = safeErrorToken(record?.code);
  const param = typeof record?.param === "string" && SAFE_ERROR_PARAMS.has(record.param)
    ? record.param
    : null;
  const errorClass = safeErrorClass(error);
  const message = typeof record?.message === "string" ? record.message.toLowerCase() : "";
  const normalizedCode = code?.toLowerCase() ?? "";

  let category: SeasonalMemoErrorCategory = "unknown";
  if (
    (status === 400 && (param === "response_format" || /schema|json/.test(message) || /schema|json/.test(normalizedCode)))
    || /schema/.test(normalizedCode)
  ) {
    category = "schema_rejection";
  } else if (status === 401 || status === 403 || ["AuthenticationError", "PermissionDeniedError"].includes(errorClass)) {
    category = "authentication";
  } else if (status === 429 || errorClass === "RateLimitError" || /rate.?limit/.test(normalizedCode)) {
    category = "rate_limit";
  } else if (status !== null && status >= 500 || errorClass === "InternalServerError") {
    category = "server";
  } else if (
    ["APIConnectionError", "APIConnectionTimeoutError", "APIUserAbortError"].includes(errorClass)
    || /ECONN|ETIMEDOUT|network|timeout/.test(normalizedCode)
  ) {
    category = "network";
  }

  return { category, status, code, param, errorClass };
}

function memoFailureCode(error: unknown): string {
  const validationReason = safeMemoValidationReason(error);
  if (validationReason) return validationReason;
  const reason = error instanceof Error ? error.message : "";
  if (reason.startsWith("memo_") || reason.startsWith("seasonal_memo_")) return reason.slice(0, 64);
  if (error instanceof SyntaxError) return "memo_json_parse_error";
  if (/timeout|timed out|deadline/i.test(reason)) return "memo_timeout";
  if (/rate.?limit|429/i.test(reason)) return "memo_rate_limited";
  return "memo_model_error";
}

function diagnosticFailureCode(diagnostics: SeasonalMemoErrorDiagnostics): string {
  switch (diagnostics.category) {
    case "schema_rejection": return "memo_schema_rejected";
    case "authentication": return "memo_authentication_error";
    case "rate_limit": return "memo_rate_limited";
    case "network": return "memo_network_error";
    case "server": return "memo_provider_error";
    default: return "memo_model_error";
  }
}

function seasonalMemoResponseFormat(locale: "en" | "ko") {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "seasonal_polaroid_memo",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          locale: { type: "string", enum: [locale] },
          lines: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
        },
        required: ["locale", "lines"],
      },
    },
  };
}

export async function generateSeasonalPolaroidMemo({
  openai,
  answers,
  image,
}: SeasonalPolaroidMemoInput): Promise<SeasonalPolaroidMemoGenerationResult> {
  let lastUsage: SeasonalPolaroidMemoGenerationResult["usage"] = null;
  let lastFailureCode = "seasonal_memo_model_or_parse_error";
  const failureCodes: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let executionStage: SeasonalMemoExecutionStage = "preparing_request";
    const markStage = (stage: SeasonalMemoExecutionStage) => {
      executionStage = stage;
    };
    try {
      markStage("preparing_request");
      const request = {
        model: "gpt-4o-mini",
        temperature: 0.35,
        // Four short lines never need more than this; the cap bounds cost if
        // the model ignores the length rules.
        max_completion_tokens: 220,
        response_format: seasonalMemoResponseFormat(answers.locale as "en" | "ko"),
        messages: image
          ? buildSeasonalPolaroidMemoVisionMessages(answers, image)
          : buildSeasonalPolaroidMemoMessages(answers),
      };
      markStage("api_call");
      const completion = await openai.chat.completions.create(request, OPENAI_CHAT_OPTIONS);
      markStage("response_received");
      lastUsage = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
            cachedPromptTokens: completion.usage.prompt_tokens_details?.cached_tokens ?? 0,
          }
        : null;
      const content = completion.choices[0]?.message.content;
      if (!content) throw new Error("seasonal_memo_empty");
      const memo = parseMemo(content, answers, markStage);
      console.info("[seasonal-polaroid] memo path", {
        path: "ai",
        outcome: attempt > 0 ? "ai_retry" : "ai_first_try",
        vision: Boolean(image),
        retried: attempt > 0,
        attempts: attempt + 1,
        failureCodes,
        ...(attempt > 0 ? { recoveredAfter: lastFailureCode } : {}),
      });
      return {
        memo,
        modelUsed: "gpt-4o-mini",
        retried: attempt > 0,
        fallback: false,
        vision: Boolean(image),
        attempts: attempt + 1,
        firstAttemptValid: attempt === 0,
        failureCodes: [...failureCodes],
        usage: lastUsage,
      };
    } catch (error) {
      // A malformed model response is retried once. The eventual fallback is
      // deterministic and never exposes malformed text to the client.
      const diagnostics = classifySeasonalMemoError(error);
      const validationReason = safeMemoValidationReason(error);
      const parsedFailureCode = memoFailureCode(error);
      lastFailureCode = parsedFailureCode === "memo_model_error"
        ? diagnosticFailureCode(diagnostics)
        : parsedFailureCode;
      failureCodes.push(lastFailureCode);
      console.warn("[seasonal-polaroid] memo request failed", {
        stage: executionStage,
        vision: Boolean(image),
        ...diagnostics,
        validationReason,
        // TypeScript cannot infer mutation through markStage's closure, so
        // preserve the runtime stage explicitly for this diagnostic check.
        validationException: (executionStage as SeasonalMemoExecutionStage) === "validation" && validationReason === null,
      });
    }
  }

  console.warn("[seasonal-polaroid] memo path", {
    path: "fallback",
    outcome: "fallback",
    vision: Boolean(image),
    retried: true,
    attempts: 2,
    failureCodes,
    validationFailureReason: lastFailureCode,
  });

  return {
    memo: fallbackSeasonalPolaroidMemo(answers),
    modelUsed: null,
    retried: true,
    fallback: true,
    vision: false,
    attempts: 2,
    firstAttemptValid: false,
    failureCodes: [...failureCodes],
    usage: lastUsage,
  };
}
