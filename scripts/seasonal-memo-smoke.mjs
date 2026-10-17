import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import OpenAI from "openai";

// The memo generator imports server-only application modules. These tiny
// loader stubs keep this script isolated from Next.js and Supabase while
// still executing the real memo-generation code.
const loaderSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default undefined;", shortCircuit: true };
  }
  if (specifier === "@/lib/supabase-server") {
    return {
      url: "data:text/javascript,export function createSupabaseServerClient() { throw new Error('Supabase is disabled in this smoke test'); }",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(loaderSource)}`, import.meta.url);

function localOpenAiKey() {
  const processKey = process.env.OPENAI_API_KEY?.trim();
  if (processKey) return processKey;

  const envPath = path.join(process.cwd(), ".env.local");
  let contents;
  try {
    contents = fs.readFileSync(envPath, "utf8");
  } catch {
    throw new Error("OPENAI_API_KEY was not found in the process environment or .env.local");
  }

  const line = contents.split(/\r?\n/u).find((entry) => /^\s*OPENAI_API_KEY\s*=/.test(entry));
  if (!line) throw new Error("OPENAI_API_KEY was not found in the process environment or .env.local");
  let value = line.slice(line.indexOf("=") + 1).trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  if (!value) throw new Error("OPENAI_API_KEY is empty");
  return value;
}

const answers = {
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
  personalDetail: "Our sunny-window cuddle",
};

const diagnostics = [];
const paths = [];
const originalWarn = console.warn;
const originalInfo = console.info;

function captureWarn(...args) {
  if (args[0] === "[seasonal-polaroid] memo request failed" && args[1] && typeof args[1] === "object") {
    diagnostics.push(args[1]);
  }
}

function captureInfo(...args) {
  if (args[0] === "[seasonal-polaroid] memo path" && args[1] && typeof args[1] === "object") {
    paths.push(args[1]);
  }
}

let apiAttempts = 0;
let result;
try {
  const [{ generateSeasonalPolaroidMemo }, { validateSeasonalPolaroidMemo }] = await Promise.all([
    import("../lib/seasonal-polaroid-ai.ts"),
    import("../lib/seasonal-polaroid-prompts.ts"),
  ]);

  const openai = new OpenAI({ apiKey: localOpenAiKey() });
  const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);
  openai.chat.completions.create = async (...request) => {
    apiAttempts += 1;
    return originalCreate(...request);
  };

  console.warn = captureWarn;
  console.info = captureInfo;
  result = await generateSeasonalPolaroidMemo({ openai, answers });
  const validation = validateSeasonalPolaroidMemo(result.memo, answers);

  console.log(JSON.stringify({
    apiAttempts,
    memo: result.memo,
    validation,
    memoFallback: result.fallback,
    textModel: result.modelUsed,
    retried: result.retried,
    diagnostics,
    paths,
    usage: result.usage,
  }, null, 2));
} catch (error) {
  // Keep runner failures safe too: never print the key, prompts, or exception
  // messages that could contain provider request details.
  console.log(JSON.stringify({
    apiAttempts,
    runnerErrorClass: error && typeof error === "object" && "name" in error && typeof error.name === "string"
      ? error.name
      : "UnknownError",
  }, null, 2));
} finally {
  console.warn = originalWarn;
  console.info = originalInfo;
}
