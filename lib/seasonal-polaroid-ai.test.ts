import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSeasonalPolaroidMemoMessages, type SeasonalPolaroidPromptAnswers } from "./seasonal-polaroid-prompts.ts";

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
  assert.match(generator, /buildSeasonalPolaroidMemoMessages\(answers\)/);
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

test("memo request sends the full questionnaire to the AI", () => {
  const messages = buildSeasonalPolaroidMemoMessages(ANSWERS);
  const userMessage = JSON.parse(messages[1]!.content) as { data: Record<string, unknown> };
  assert.equal(messages[0]!.role, "system");
  assert.equal(messages[1]!.role, "user");
  assert.equal(userMessage.data.petName, "Mochi");
  assert.equal(userMessage.data.ownerCallName, "Mom");
  assert.equal(userMessage.data.habit, "napping in every sunbeam");
  assert.equal(userMessage.data.personalDetail, "Waits by the window.");
  assert.deepEqual(userMessage.data.personalities, ["a love of snacks", "a deep love of cuddles"]);
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
