import OpenAI, { toFile } from "openai";

import { OPENAI_CHAT_OPTIONS, OPENAI_IMAGE_OPTIONS } from "./ai-generation-guard.ts";

export type VisualMemoryMode = "living" | "memorial";

export type VisualMemoryCopy = {
  title: string;
  caption: string;
};

export type VisualMemoryCaptionGenerationResult = {
  copy: VisualMemoryCopy;
  modelUsed: "gpt-4o-mini";
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedPromptTokens: number;
  } | null;
};

export type VisualMemoryImageModel = "gpt-image-2.5-sunburst" | "gpt-image-2";

export type VisualMemoryImageUsage = {
  input_tokens: number;
  input_tokens_details: {
    image_tokens: number;
    text_tokens: number;
  };
  output_tokens: number;
  total_tokens: number;
  output_tokens_details?: {
    image_tokens: number;
    text_tokens: number;
  };
};

export type VisualMemoryImageGenerationResult = {
  imageBase64: string | null;
  modelUsed: VisualMemoryImageModel;
  usage: VisualMemoryImageUsage | undefined;
};

export type VisualMemoryImageInput = {
  openai: OpenAI;
  referenceBytes: ArrayBuffer;
  referenceName: string;
  referenceType: string;
  prompt: string;
};

export type PetImageReference = {
  bytes: ArrayBuffer;
  name: string;
  type: string;
};

export type PetImageGenerationInput = {
  openai: OpenAI;
  references: readonly PetImageReference[];
  prompt: string;
  size: "1024x1024" | "1024x1536";
  logLabel?: string;
};

/**
 * Shared identity-preservation rules for pet image generation. Keep these
 * rules server-side and include them in every prompt that transforms a pet
 * reference photo.
 */
export function petIdentityPreservationPrompt(): readonly string[] {
  return [
    "REFERENCE ROLE — IDENTITY: The input photo is the sole authoritative identity reference for this specific individual pet, not a generic breed reference and not a composition reference.",
    "ALLOWED CHANGES: The pose, environment, lighting, framing, and camera angle may change to fit the memory.",
    [
      "FIXED IDENTITY CONSTRAINTS — preserve exactly from the reference:",
      "- exact muzzle length, width, depth, taper, and overall shape",
      "- exact eye size, eye shape, spacing, eyelid contours, gaze character, and expression characteristics",
      "- exact facial proportions and spatial relationships among eyes, brow, nose, cheeks, muzzle, and ears",
      "- exact eyebrow marking size, shape, color, placement, edge softness, and any left-right differences",
      "- natural asymmetry in every facial and body marking; preserve distinctive imperfections and asymmetric features rather than regularizing them",
      "- exact coat colors, undertones, texture, and boundaries between black, tan, cream, white, or other color regions",
      "- exact ear silhouette, angle, height, width, spacing, tip shape, and proportions relative to the head",
      "- exact nose size, width, projection, shape, and placement",
      "- exact head-to-neck and head-to-body proportions, breed appearance, build, and body proportions",
      "- the pet's real apparent age and all individually distinctive features visible in the reference",
    ].join("\n"),
    "Do not beautify, idealize, retouch, cartoonize, stylize, make the pet younger, make the face rounder or cuter, enlarge or brighten the eyes, shorten or widen the muzzle, change the nose, exaggerate breed traits, clean up irregular markings, or make markings larger, sharper, more balanced, or more symmetrical.",
    "Identity fidelity is more important than a conventionally cute or perfect result. The output must look like a new real photograph of the same individual pet, not a similar pet of the same breed.",
  ];
}

export async function generateVisualMemoryImage({
  openai,
  referenceBytes,
  referenceName,
  referenceType,
  prompt,
}: VisualMemoryImageInput): Promise<VisualMemoryImageGenerationResult> {
  return generatePetReferenceImage({
    openai,
    references: [{ bytes: referenceBytes, name: referenceName, type: referenceType }],
    prompt,
    size: "1024x1536",
    logLabel: "visual-memory",
  });
}

/**
 * Shared image-edit adapter for pet experiences. Visual Memory keeps its
 * existing portrait settings; Seasonal Polaroid can provide one or two
 * identity references and a square output without reimplementing fallback,
 * timeout, and response extraction behavior.
 */
export async function generatePetReferenceImage({
  openai,
  references,
  prompt,
  size,
  logLabel = "pet-image",
}: PetImageGenerationInput): Promise<VisualMemoryImageGenerationResult> {
  if (!references.length) throw new Error("At least one pet reference is required.");
  const generateWithModel = async (model: VisualMemoryImageModel) =>
    openai.images.edit({
      model,
      image: references.length === 1
        ? await toFile(references[0]!.bytes, references[0]!.name, { type: references[0]!.type })
        : await Promise.all(references.map((reference) =>
            toFile(reference.bytes, reference.name, { type: reference.type }),
          )),
      prompt,
      n: 1,
      size,
      quality: "medium",
      output_format: "jpeg",
      output_compression: 85,
    }, OPENAI_IMAGE_OPTIONS);

  let modelUsed: VisualMemoryImageModel = "gpt-image-2.5-sunburst";
  let result;
  try {
    result = await generateWithModel(modelUsed);
  } catch (error) {
    if (!isModelAccessError(error)) throw error;
    modelUsed = "gpt-image-2";
    console.warn(`[${logLabel}] Sunburst is unavailable to this API project; using gpt-image-2.`);
    result = await generateWithModel(modelUsed);
  }

  return {
    imageBase64: result.data?.[0]?.b64_json ?? null,
    modelUsed,
    usage: result.usage,
  };
}

const SCENE_TITLES: Record<string, { en: string; ko: string }> = {
  "by-the-sea": { en: "By the Sea", ko: "바닷가에서" },
  "at-home": { en: "At Home", ko: "집에서" },
  "on-a-walk": { en: "Our Walk", ko: "우리의 산책" },
  "flower-field": { en: "Among the Flowers", ko: "꽃밭에서" },
  playtime: { en: "Playtime", ko: "놀이 시간" },
  "cozy-bedtime": { en: "Close at Bedtime", ko: "포근한 밤" },
  "golden-sunset": { en: "Golden Evening", ko: "황금빛 저녁" },
  "favorite-place": { en: "A Favorite Place", ko: "좋아했던 장소" },
  "our-walk": { en: "Our Evening Walk", ko: "우리의 산책" },
  "peaceful-garden": { en: "In the Garden", ko: "정원에서" },
  "golden-evening": { en: "Golden Evening", ko: "황금빛 저녁" },
  "together-again": { en: "Together Again", ko: "다시 함께" },
};

export function fallbackVisualMemoryCopy(selectedSceneId: string, memoryDetail: string): VisualMemoryCopy {
  const language = /[가-힣]/u.test(memoryDetail) ? "ko" : "en";
  return {
    title: SCENE_TITLES[selectedSceneId]?.[language] ?? (language === "ko" ? "소중한 순간" : "A Special Moment"),
    caption: memoryDetail,
  };
}

function cleanGeneratedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/^["“”']+|["“”']+$/gu, "");
  return cleaned && cleaned.length <= maxLength ? cleaned : null;
}

export async function generateVisualMemoryCopy({
  openai,
  selectedSceneId,
  memoryDetail,
  mode,
  petName,
  petType,
  breed,
}: {
  openai: OpenAI;
  selectedSceneId: string;
  memoryDetail: string;
  mode: VisualMemoryMode;
  petName: string;
  petType: string;
  breed: string;
}): Promise<VisualMemoryCaptionGenerationResult> {
  const tenseGuidance = mode === "living"
    ? [
        "LIVING TENSE: Prefer present tense or timeless present for habits, affection, routines, and everyday behavior (for example: You always stay close to me. You make every walk feel special.).",
        "Use past tense only when memoryDetail clearly describes one specific completed past event. Never turn an everyday living-pet habit into memorial-style past tense.",
        "For Korean living memories, use natural present, habitual, or timeless phrasing for ongoing routines and affection (for example: 늘 내 곁에 있어 줘. 산책할 때마다 나를 돌아봐.). Use past phrasing only for a clearly completed event; do not translate English tense mechanically.",
      ]
    : [
        "MEMORIAL TENSE: Prefer past tense for the pet's habits, actions, routines, and shared memories (for example: You always waited for me by the door. You loved sitting beside me in the evening.).",
        "Do not describe the pet as currently performing an everyday action unless memoryDetail explicitly requests a symbolic or fantasy interpretation.",
        "Timeless present is allowed only for the memory's lasting meaning or emotional impact (for example: That little memory still stays close to my heart.). Past tense may describe what happened while present tense describes only what the memory still means now.",
        "For Korean memorial memories, use natural recollective past or habitual-past phrasing for the pet's actions (for example: 늘 문 앞에서 기다려 주었어. 저녁이면 내 곁에 앉아 있곤 했어.). Present phrasing may describe only the memory's continuing meaning (for example: 그 기억은 지금도 마음에 남아 있어.). Do not translate English tense mechanically.",
      ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "Write only a Polaroid title and one short caption for a pet memory.",
          "Return one JSON object with exactly two string fields: title and caption.",
          "Base every word on the supplied scene ID and memory detail. Do not inspect or describe an image and do not invent visual details, events, people, objects, or emotions not supported by the memory.",
          "The caption must be a close, natural paraphrase of memoryDetail. Use the scene ID mainly to shape the title; never add weather, time of day, scenery, or actions to the caption unless memoryDetail explicitly states them.",
          "Do not add motives (such as making sure someone was there), emotional interpretations (such as warmth or joy), or preferences (such as loved) unless those exact meanings are present in memoryDetail.",
          "Before responding, verify that every factual detail in the caption is directly traceable to memoryDetail.",
          "Write in the same language as the memory detail.",
          "Title: ideally 2-5 words, emotional but natural, no quotation marks, no emoji.",
          "Caption: one sentence of approximately 8-20 words, like a small fragment of a letter or memory; preserve the user's meaning and avoid generic AI language.",
          "Preserve the user's original meaning. Do not mechanically force every sentence into one tense when the grammar would become unnatural.",
          "Use natural English conjugation and subject-verb agreement. Do not mix present and past tense inconsistently within the short caption.",
          "For Korean, choose natural Korean temporal and recollective phrasing from context rather than literally translating English tense rules.",
          ...(mode === "living"
            ? ["Living mode should feel warm, affectionate, present or timeless, and playful only when supported."]
            : ["Memorial mode should feel gentle, reflective, and memory-oriented. Never automatically mention death, heaven, Rainbow Bridge, loss, goodbye, or being gone."]),
          ...tenseGuidance,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          selectedSceneId,
          memoryDetail,
          mode,
          ...(petName ? { petName } : {}),
          ...(petType ? { petType } : {}),
          ...(breed ? { breed } : {}),
        }),
      },
    ],
  }, OPENAI_CHAT_OPTIONS);

  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("No Polaroid copy was returned.");
  const parsed = JSON.parse(content) as Partial<VisualMemoryCopy>;
  const title = cleanGeneratedText(parsed.title, 80);
  const caption = cleanGeneratedText(parsed.caption, 240);
  if (!title || !caption) throw new Error("The Polaroid copy was invalid.");
  return {
    copy: { title, caption },
    modelUsed: "gpt-4o-mini",
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
          cachedPromptTokens: completion.usage.prompt_tokens_details?.cached_tokens ?? 0,
        }
      : null,
  };
}

export function isModelAccessError(error: unknown): boolean {
  if (!(error instanceof OpenAI.APIError)) return false;
  if (![400, 403, 404].includes(error.status ?? 0)) return false;
  const detail = `${error.code ?? ""} ${error.type ?? ""} ${error.message}`;
  return /model|access|permission|not[ _-]?found|organization verification/i.test(detail);
}
