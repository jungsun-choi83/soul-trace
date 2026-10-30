import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildSeasonalPolaroidMemoMessages,
  validateSeasonalPolaroidMemo,
  type SeasonalPolaroidPromptAnswers,
} from "./seasonal-polaroid-prompts.ts";

// The production generator is server-only because it imports the shared
// server guard. Stub those server-only modules here so these tests can run a
// mocked memo request without Supabase, a worker, or OpenAI.
const testLoader = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export default {}", shortCircuit: true };
    }
    if (specifier === "@/lib/supabase-server") {
      return {
        url: "data:text/javascript,export function createSupabaseServerClient() { throw new Error('not used in memo tests') }",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(testLoader)}`, import.meta.url);
const { classifySeasonalMemoError, generateSeasonalPolaroidMemo } = await import("./seasonal-polaroid-ai.ts");

const generator = readFileSync(resolve(process.cwd(), "lib/seasonal-polaroid-ai.ts"), "utf8");

test("memo generation retries once and falls back after bounded model failures", () => {
  assert.match(generator, /for \(let attempt = 0; attempt < 2; attempt \+= 1\)/);
  assert.match(generator, /catch \(error\)/);
  assert.match(generator, /fallbackSeasonalPolaroidMemo\(answers\)/);
  assert.match(generator, /retried: true/);
  assert.match(generator, /path: "fallback"/);
  assert.match(generator, /validationFailureReason/);
});

test("memo generation uses structured JSON and validates the requested locale", () => {
  assert.match(generator, /response_format: seasonalMemoResponseFormat\(answers\.locale as "en" \| "ko"\)/);
  assert.match(generator, /type: "json_schema"/);
  assert.match(generator, /required: \["locale", "lines"\]/);
  assert.match(generator, /validateSeasonalPolaroidMemo\(parsed, answers\)/);
  assert.match(generator, /buildSeasonalPolaroidMemoMessages\(/);
  assert.match(generator, /model: "gpt-4o-mini"/);
  assert.match(generator, /path: "ai"/);
  assert.match(generator, /recoveredAfter/);
  assert.match(generator, /stage: executionStage/);
  assert.match(generator, /response_parsing/);
  assert.match(generator, /validation/);
});

const ANSWERS: SeasonalPolaroidPromptAnswers = {
  themeId: "halloween",
  locale: "en",
  petName: "Mochi",
  species: "cat",
  status: "living",
  costume: "pumpkin",
  scene: "pumpkin-patch",
  vibe: "cute-cozy",
  personalities: ["foodie", "cuddle-bug"],
  habit: "sunbeam-napper",
  favoriteTreat: "tuna",
  callName: "mom",
  personalDetail: "Waits by the window.",
};

test("memo request sends the compact brief, not the full questionnaire, to the AI", () => {
  const messages = buildSeasonalPolaroidMemoMessages(ANSWERS);
  const userMessage = JSON.parse(messages[1]!.content) as { brief: Record<string, unknown> };
  assert.equal(messages[0]!.role, "system");
  assert.equal(messages[1]!.role, "user");
  assert.equal(userMessage.brief.petName, "Mochi");
  assert.equal(userMessage.brief.ownerCallName, "Mom");
  assert.equal(userMessage.brief.personality, "a love of snacks");
  assert.equal(userMessage.brief.personalTouch, "Waits by the window.");
  assert.deepEqual(userMessage.brief.background, { kind: "habit", text: "napping in every sunbeam" });
  assert.equal("habit" in userMessage.brief, false, "non-focus habit must not reach the caption model");
  assert.equal("favoriteTreat" in userMessage.brief, false);
  assert.equal("costume" in userMessage.brief, false);
});

function capturingOpenAi(content: string, requests: unknown[]) {
  return {
    chat: {
      completions: {
        create: async (request: unknown) => {
          requests.push(request);
          return { choices: [{ message: { content } }], usage: null };
        },
      },
    },
  } as never;
}

const VALID_LINES = [
  "Mom, happy Halloween from Mochi!",
  "I'm curled up by the window,",
  "and my pumpkin hat slipped over one ear",
  "while I wait for a bite of tuna.",
];

test("image-first caption request attaches the generated photo and the brief in one call", async () => {
  const requests: unknown[] = [];
  const result = await generateSeasonalPolaroidMemo({
    openai: capturingOpenAi(JSON.stringify({ locale: "en", lines: VALID_LINES }), requests),
    answers: ANSWERS,
    image: { base64: "aGVsbG8=", mimeType: "image/jpeg" },
  });

  assert.equal(requests.length, 1);
  const request = requests[0] as {
    model: string;
    max_completion_tokens: number;
    messages: Array<{ role: string; content: unknown }>;
  };
  assert.equal(request.model, "gpt-4o-mini");
  assert.equal(request.max_completion_tokens, 220);
  assert.equal(request.messages[0]!.role, "system");
  const user = request.messages[1]!.content as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(user));
  assert.equal(user[0]!.type, "text");
  assert.match(String(user[0]!.text), /"personalTouch"/);
  assert.equal(user[1]!.type, "image_url");
  assert.deepEqual(user[1]!.image_url, { url: "data:image/jpeg;base64,aGVsbG8=", detail: "low" });
  assert.equal(result.vision, true);
  assert.equal(result.fallback, false);
  assert.deepEqual(result.memo.lines, VALID_LINES);
  assert.equal(result.attempts, 1);
  assert.equal(result.firstAttemptValid, true);
  assert.deepEqual(result.failureCodes, []);
});

test("telemetry distinguishes a first-try success, an AI retry, and a fallback without leaking text", async () => {
  const replies = [
    JSON.stringify({ locale: "en", lines: ["Mom, happy Halloween from Mochi!", "I'm curled up by the window with my pumpkin hat on tonight,", "and still dreaming of tuna.", "This tiny moment feels like home."] }),
    JSON.stringify({ locale: "en", lines: VALID_LINES }),
  ];
  const openai = { chat: { completions: { create: async () => ({ choices: [{ message: { content: replies.shift() } }], usage: null }) } } } as never;
  const logs: unknown[][] = [];
  const previousInfo = console.info;
  const previousWarn = console.warn;
  console.info = (...args: unknown[]) => logs.push(args);
  console.warn = (...args: unknown[]) => logs.push(args);
  let retried;
  let fallback;
  try {
    retried = await generateSeasonalPolaroidMemo({ openai, answers: ANSWERS, image: { base64: "aGVsbG8=", mimeType: "image/jpeg" } });
    fallback = await generateSeasonalPolaroidMemo({
      openai: mockedOpenAi(JSON.stringify({ locale: "en", lines: ["Mochi says hi", "x", "y", "z"] }), { count: 0 }),
      answers: ANSWERS,
    });
  } finally {
    console.info = previousInfo;
    console.warn = previousWarn;
  }
  assert.equal(retried.attempts, 2);
  assert.equal(retried.firstAttemptValid, false);
  assert.deepEqual(retried.failureCodes, ["memo_line_length"]);
  assert.equal(retried.fallback, false);
  assert.equal(fallback.attempts, 2);
  assert.equal(fallback.firstAttemptValid, false);
  assert.deepEqual(fallback.failureCodes, ["memo_missing_call_name", "memo_missing_call_name"]);
  const outcomes = logs.filter((args) => args[0] === "[seasonal-polaroid] memo path").map((args) => (args[1] as { outcome: string }).outcome);
  assert.deepEqual(outcomes, ["ai_retry", "fallback"]);
  assert.doesNotMatch(JSON.stringify(logs), /Mochi|pumpkin|tuna|window/i);
});

test("text-only caption request stays a plain string message", async () => {
  const requests: unknown[] = [];
  const result = await generateSeasonalPolaroidMemo({
    openai: capturingOpenAi(JSON.stringify({ locale: "en", lines: VALID_LINES }), requests),
    answers: ANSWERS,
  });
  const request = requests[0] as { messages: Array<{ content: unknown }> };
  assert.equal(typeof request.messages[1]!.content, "string");
  assert.equal(result.vision, false);
});

test("a caption that tells the owner what to do is rejected and recovered without a second image", async () => {
  const requests: unknown[] = [];
  const warnings: unknown[][] = [];
  const previousWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  let result;
  try {
    result = await generateSeasonalPolaroidMemo({
      openai: capturingOpenAi(JSON.stringify({
        locale: "en",
        lines: [
          "Mom, happy Halloween from Mochi!",
          "I'm glowing in my pumpkin costume,",
          "and my tuna dreams feel warm tonight.",
          "Hold me near and keep smiling with me.",
        ],
      }), requests),
      answers: ANSWERS,
      image: { base64: "aGVsbG8=", mimeType: "image/jpeg" },
    });
  } finally {
    console.warn = previousWarn;
  }
  assert.equal(requests.length, 2, "one retry, both caption-only");
  assert.equal(result.fallback, true);
  assert.equal(result.vision, false);
  const failure = warnings.find((args) => args[0] === "[seasonal-polaroid] memo request failed");
  assert.equal((failure?.[1] as { validationReason: string }).validationReason, "memo_owner_instruction");
  assert.equal((failure?.[1] as { vision: boolean }).vision, true);
});

function mockedOpenAi(content: string, calls: { count: number }) {
  return {
    chat: {
      completions: {
        create: async () => {
          calls.count += 1;
          return { choices: [{ message: { content } }], usage: null };
        },
      },
    },
  } as never;
}

function mockedOpenAiSequence(contents: string[], calls: { count: number }, requests: unknown[] = []) {
  return {
    chat: {
      completions: {
        create: async (request: unknown) => {
          requests.push(request);
          const content = contents[Math.min(calls.count, contents.length - 1)]!;
          calls.count += 1;
          return { choices: [{ message: { content } }], usage: null };
        },
      },
    },
  } as never;
}

test("valid English structured memo reaches the AI path without fallback", async () => {
  const calls = { count: 0 };
  const result = await generateSeasonalPolaroidMemo({
    openai: mockedOpenAi(JSON.stringify({
      locale: "en",
      lines: [
        "Mom, happy Halloween from Mochi!",
        "I see pumpkin lights,",
        "and my whiskers dance while I nap.",
        "and my tiny purr fills the frame.",
      ],
    }), calls),
    answers: ANSWERS,
  });

  assert.equal(calls.count, 1);
  assert.equal(result.fallback, false);
  assert.equal(result.modelUsed, "gpt-4o-mini");
  assert.deepEqual(result.memo.lines, [
    "Mom, happy Halloween from Mochi!",
    "I see pumpkin lights,",
    "and my whiskers dance while I nap.",
    "and my tiny purr fills the frame.",
  ]);
});

test("valid Korean structured memo reaches the AI path without fallback", async () => {
  const calls = { count: 0 };
  const answers: SeasonalPolaroidPromptAnswers = {
    ...ANSWERS,
    locale: "ko",
    petName: "모찌",
    callName: "mom",
  };
  const result = await generateSeasonalPolaroidMemo({
    openai: mockedOpenAi(JSON.stringify({
      locale: "ko",
      lines: [
        "엄마, 모찌가 해피 할로윈!",
        "호박 옷 입고,",
        "참치 간식이 제일 좋아요.",
        "포근한 밤의 작은 순간이에요.",
      ],
    }), calls),
    answers,
  });

  assert.equal(calls.count, 1);
  assert.equal(result.fallback, false);
  assert.equal(result.modelUsed, "gpt-4o-mini");
  assert.equal(result.memo.locale, "ko");
  assert.equal(result.memo.lines.length, 4);
});

test("memo retries an overlong response with an explicit compact rewrite instruction", async () => {
  const calls = { count: 0 };
  const requests: unknown[] = [];
  const result = await generateSeasonalPolaroidMemo({
    openai: mockedOpenAiSequence([
      JSON.stringify({
        locale: "en",
        lines: [
          "Mom, happy Halloween from Mochi!",
          `and I ${"x".repeat(40)},`,
          "and my tiny purr fills the frame.",
          "and I cuddle close tonight.",
        ],
      }),
      JSON.stringify({
        locale: "en",
        lines: [
          "Mom, happy Halloween from Mochi!",
          "I see pumpkin lights,",
          "and my whiskers dance while I nap.",
          "and my tiny purr fills the frame.",
        ],
      }),
    ], calls, requests),
    answers: ANSWERS,
  });

  assert.equal(calls.count, 2);
  assert.equal(result.fallback, false);
  assert.equal(result.retried, true);
  const retrySystemPrompt = ((requests[1] as { messages: Array<{ content: string }> }).messages[0]!).content;
  assert.match(retrySystemPrompt, /Retry correction/);
  assert.match(retrySystemPrompt, /Preserve the selected factual questionnaire details/);
  assert.match(retrySystemPrompt, /lines 2-4 must each be 40 characters or fewer/);
});

test("line-length failures fall back to valid personalized captions in both languages", async () => {
  for (const answers of [
    { ...ANSWERS, personalDetail: "x".repeat(60) },
    {
      ...ANSWERS,
      locale: "ko" as const,
      petName: "紐⑥컡",
      callName: "mom",
      status: "passed" as const,
      costume: "little-angel",
      scene: "lantern-meadow",
      vibe: "gentle-warm",
      personalDetail: "x".repeat(60),
    },
  ]) {
    const calls = { count: 0 };
    const overlong = answers.locale === "ko"
      ? "?꾨쭏, 紐⑥컡媛 ?댄뵾 ?좊줈??"
      : "Mom, happy Halloween from Mochi!";
    const invalidResponse = JSON.stringify({
      locale: answers.locale,
      lines: [overlong, answers.locale === "ko" ? `?섎뒗 ${"媛".repeat(30)},` : `and I ${"x".repeat(40)},`, "and I nap,", "and I purr."],
    });
    const result = await generateSeasonalPolaroidMemo({
      openai: mockedOpenAi(invalidResponse, calls),
      answers,
    });

    assert.equal(calls.count, 2);
    assert.equal(result.fallback, true);
    assert.equal(result.modelUsed, null);
    assert.equal(validateSeasonalPolaroidMemo(result.memo, answers).valid, true);
    assert.match(result.memo.lines[0], new RegExp(answers.petName));
  }
});

test("missing or mismatched locale remains rejected and falls back safely", async () => {
  for (const response of [
    {
      lines: [
        "Mom, happy Halloween from Mochi!",
        "Pumpkin lights make my whiskers dance.",
        "I nap in sunbeams and dream of tuna.",
        "Keep my tiny purr close, Mom.",
      ],
    },
    {
      locale: "ko",
      lines: [
        "Mom, happy Halloween from Mochi!",
        "Pumpkin lights make my whiskers dance.",
        "I nap in sunbeams and dream of tuna.",
        "Keep my tiny purr close, Mom.",
      ],
    },
  ]) {
    const calls = { count: 0 };
    const result = await generateSeasonalPolaroidMemo({
      openai: mockedOpenAi(JSON.stringify(response), calls),
      answers: ANSWERS,
    });

    assert.equal(calls.count, 2);
    assert.equal(result.fallback, true);
    assert.equal(result.modelUsed, null);
    assert.equal(result.memo.lines.length, 4);
  }
});

test("validation diagnostics identify the rejected rule without model text", async () => {
  const warnings: unknown[][] = [];
  const previousWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = await generateSeasonalPolaroidMemo({
      openai: mockedOpenAi(JSON.stringify({
        locale: "en",
        lines: [
          "Mom, happy Halloween from Mochi!",
          "Mochi wears pumpkin.",
          "I nap in sunbeams and dream of tuna.",
          "Keep my tiny purr close, Mom.",
        ],
      }), { count: 0 }),
      answers: ANSWERS,
    });
    assert.equal(result.fallback, true);
  } finally {
    console.warn = previousWarn;
  }

  const failures = warnings.filter((args) => args[0] === "[seasonal-polaroid] memo request failed");
  assert.equal(failures.length, 2);
  for (const [, details] of failures) {
    assert.equal((details as { stage: string }).stage, "validation");
    assert.equal((details as { validationReason: string }).validationReason, "memo_third_person");
    assert.equal((details as { validationException: boolean }).validationException, false);
    assert.doesNotMatch(JSON.stringify(details), /Mochi|pumpkin/i);
  }

  const fallback = warnings.find((args) => args[0] === "[seasonal-polaroid] memo path");
  assert.equal((fallback?.[1] as { validationFailureReason: string }).validationFailureReason, "memo_third_person");
});

test("AI memo retries when a body line is not explicitly first-person", async () => {
  const warnings: unknown[][] = [];
  const previousWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const result = await generateSeasonalPolaroidMemo({
      openai: mockedOpenAi(JSON.stringify({
        locale: "en",
        lines: [
          "Mom, happy Halloween from Mochi!",
          "Pumpkin glow warms the room.",
          "I nap in sunbeams and dream of tuna.",
          "I’ll cuddle close tonight.",
        ],
      }), { count: 0 }),
      answers: ANSWERS,
    });
    assert.equal(result.fallback, true);
  } finally {
    console.warn = previousWarn;
  }

  const failure = warnings.find((args) => args[0] === "[seasonal-polaroid] memo request failed");
  assert.equal((failure?.[1] as { validationReason: string }).validationReason, "memo_not_first_person");
});

test("memo provider diagnostics classify failures without exposing messages", () => {
  const schema = classifySeasonalMemoError(Object.assign(new Error("schema contains a secret"), {
    status: 400,
    code: "invalid_request_error",
    param: "response_format",
  }));
  assert.deepEqual(schema, {
    category: "schema_rejection",
    status: 400,
    code: "invalid_request_error",
    param: "response_format",
    errorClass: "Error",
  });

  assert.equal(classifySeasonalMemoError({ name: "AuthenticationError", status: 401, code: "invalid_api_key" }).category, "authentication");
  assert.equal(classifySeasonalMemoError({ name: "RateLimitError", status: 429, code: "rate_limit_exceeded" }).category, "rate_limit");
  assert.equal(classifySeasonalMemoError({ name: "APIConnectionError", code: "ECONNRESET" }).category, "network");
  assert.equal(classifySeasonalMemoError({ name: "InternalServerError", status: 503 }).category, "server");
  const unknown = classifySeasonalMemoError({ name: "UnexpectedError", message: "private prompt" });
  assert.equal(unknown.errorClass, "UnknownError");
  assert.doesNotMatch(JSON.stringify(unknown), /private prompt/);
});
