import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";

const testLoader = `
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export default {}", shortCircuit: true };
    }
    if (specifier === "@/lib/supabase-server") {
      return {
        url: "data:text/javascript,export function createSupabaseServerClient() { throw new Error('not used') }",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  }
`;
register(`data:text/javascript,${encodeURIComponent(testLoader)}`, import.meta.url);
const { buildTrialPolaroidPrompt, generateTrialPolaroidImage, TRIAL_THEME_IDS } = await import("./trial-polaroid-ai.ts");

test("trial prompt restyles the pet into the plate and forbids a pasted photo", () => {
  for (const theme of TRIAL_THEME_IDS) {
    const prompt = buildTrialPolaroidPrompt("gouache-story", theme);
    assert.match(prompt, /pasted|cutout photograph/i);
    assert.match(prompt, /first image is the real pet/i);
    assert.match(prompt, /second image is the finished background/i);
    assert.doesNotMatch(prompt, /must look like a new real photograph/i);
    assert.doesNotMatch(prompt, /Do not beautify/i);
  }
  assert.match(buildTrialPolaroidPrompt("gouache-story", "christmas-village"), /gouache/i);
  assert.match(buildTrialPolaroidPrompt("felt-doll", "spring-picnic"), /needle-felted wool/i);
  assert.match(buildTrialPolaroidPrompt("crayon-diary", "summer-beach"), /pastel vintage/i);
  assert.match(buildTrialPolaroidPrompt("crayon-diary", "first-snow-street"), /snow contact/i);
  assert.match(buildTrialPolaroidPrompt("gouache-story", "birthday-room"), /Do not add snow/);
});

test("trial generation sends the pet and the background plate as two references", async () => {
  const seen: { image: unknown; prompt: string; size: string; quality: string }[] = [];
  const openai = {
    images: {
      edit: async (body: { image: unknown; prompt: string; size: string; quality: string }) => {
        seen.push(body);
        return { data: [{ b64_json: "abc" }], usage: undefined };
      },
    },
  };
  const pet = { bytes: Uint8Array.from([1, 2, 3]).buffer, name: "pet.jpg", type: "image/jpeg" };
  const plate = { bytes: Uint8Array.from([4, 5, 6]).buffer, name: "plate.jpg", type: "image/jpeg" };
  const result = await generateTrialPolaroidImage({
    openai: openai as never,
    pet,
    plate,
    style: "felt-doll",
    theme: "christmas-village",
  });
  assert.equal(result.imageBase64, "abc");
  assert.equal(seen.length, 1);
  assert.ok(Array.isArray(seen[0]?.image));
  assert.equal((seen[0]?.image as unknown[]).length, 2);
  assert.equal(seen[0]?.size, "1536x1024");
  assert.equal(seen[0]?.quality, "high");
  assert.match(seen[0]?.prompt ?? "", /needle-felted wool/i);
});

test("seasonal polaroid generation still uses only the pet photo", () => {
  const generator = readFileSync("lib/seasonal-polaroid-ai.ts", "utf8");
  assert.match(generator, /const references = \[primary\];/);
  assert.doesNotMatch(generator, /secondary/);
});
