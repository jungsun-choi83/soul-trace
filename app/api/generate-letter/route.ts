import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import type { Locale } from "@/lib/i18n";
import { normalizePersonalityTags } from "@/lib/normalize-personality-tags";
import OpenAI from "openai";
import { appendSoulTraceToGoogleSheets } from "@/lib/google-sheets-ingest";
import {
  buildLetterAddressingBlock,
  buildPetProfilePromptBlock,
  letterPetName,
  type LetterRecipient,
  type PetIntroProfile,
  type PetType,
} from "@/lib/pet-profile";
import {
  buildTonePromptBlock,
  type LetterToneOption,
  type LetterTonePrefs,
} from "@/lib/survey";
import { DEFAULT_LETTER_MODE, isLetterMode, type LetterMode } from "@/lib/letter-mode";
import { conversationalLetterVoiceRules, letterPremiseBlock } from "@/lib/letter-voice";
import {
  createSupabaseServerClient,
  isRetryableSupabaseMessage,
  sleep,
} from "@/lib/supabase-server";
import { resolvePartnerCode } from "@/lib/partner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { NextResponse } from "next/server";

type AnswerInput = {
  question: string;
  answer: string;
};

type RequestBody = {
  locale?: string;
  /** 편지 갈래. 없으면 추모 — 이 필드가 생기기 전 클라이언트와 같은 동작. */
  mode?: string;
  userEmail?: string;
  petName?: string;
  petNickname?: string;
  petType?: string;
  yearMet?: number;
  yearParted?: number;
  letterRecipient?: string;
  letterRecipientDetail?: string;
  preferredScenery?: string;
  tonePrefs?: {
    mood?: string;
    options?: string[];
    length?: string;
  };
  privacyConsent?: boolean;
  answers?: AnswerInput[];
  /** 언어 전환 등 텍스트만 다시 생성할 때 — 배경 이미지 API 호출 생략 */
  skipImageGeneration?: boolean;
  existingHeroImageUrl?: string | null;
  /** 첫 생성: 편지를 SSE로 스트리밍 (이미지는 병렬로 진행) */
  stream?: boolean;
  /**
   * 파트너 QR 의 불투명 코드(`?p=`). **partner_id 가 아니다** —
   * 어느 파트너인지는 서버가 조회해서 정한다. 브라우저가 partner_id 를 보낼 수
   * 있으면 누구나 남의 병원에 귀속시킬 수 있고, 그것은 정산 조작이다.
   */
  partnerCode?: string;
};

const PET_TYPES: PetType[] = ["dog", "cat", "rabbit", "hamster", "bird", "other"];
const LETTER_RECIPIENTS: LetterRecipient[] = ["mom", "dad", "both", "sibling", "byName", "custom"];

function parsePetProfileFromBody(body: RequestBody): PetIntroProfile | null {
  const petName = body.petName?.trim() ?? "";
  const petType = body.petType?.trim() ?? "";
  const letterRecipient = body.letterRecipient?.trim() ?? "";
  const yearMet =
    typeof body.yearMet === "number" && Number.isFinite(body.yearMet)
      ? String(body.yearMet)
      : "";
  const yearParted =
    typeof body.yearParted === "number" && Number.isFinite(body.yearParted)
      ? String(body.yearParted)
      : "";

  if (
    !petName ||
    !PET_TYPES.includes(petType as PetType) ||
    !LETTER_RECIPIENTS.includes(letterRecipient as LetterRecipient) ||
    !yearMet ||
    !yearParted
  ) {
    return null;
  }

  return {
    petName,
    petNickname: body.petNickname?.trim() ?? "",
    petType: petType as PetType,
    yearMet,
    yearParted,
    letterRecipient: letterRecipient as LetterRecipient,
    letterRecipientDetail: body.letterRecipientDetail?.trim() ?? "",
  };
}

function sceneryFallback(locale: Locale, answers: AnswerInput[]): string {
  const fromSurvey = answers[0]?.answer?.trim() ?? "";
  if (fromSurvey) return fromSurvey;
  return locale === "ko" ? "함께했던 추억의 장소" : "a place you shared together";
}

function parseTonePrefs(body: RequestBody): LetterTonePrefs | null {
  const raw = body.tonePrefs;
  if (!raw?.mood || !raw.length) return null;
  const mood = raw.mood;
  if (mood !== "bright" && mood !== "calm" && mood !== "warm") return null;
  const length = raw.length;
  if (length !== "short" && length !== "normal") return null;
  const options = (raw.options ?? []).filter(
    (o): o is LetterToneOption => o === "comfort" || o === "no_heaven" || o === "frequent_name",
  );
  return { mood, length, options };
}

type ParsedResponse = {
  personalityType: string;
  personalitySummary: string;
  personalityTags: string[];
  letter: string;
};

const ERR = { ko: ko.errors, en: en.errors };

/** Vercel/로컬: `1`, `true`, `yes`, `on` 이면 배경 이미지 API를 호출하지 않음 — 비용·대기 시간 대폭 절감 */
function envSkipsHeroImage(): boolean {
  const v = process.env.SOUL_TRACE_SKIP_HERO_IMAGE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

const PROMPT_Q_MAX = 140;
const PROMPT_A_MAX = 500;

function clampPromptField(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function err(locale: Locale, key: keyof typeof ko.errors, status: number) {
  return NextResponse.json({ error: ERR[locale][key] }, { status });
}

function friendlyGenerateError(locale: Locale): string {
  return ERR[locale].generateFailed;
}

function parseLetterCompletion(
  completion: { choices: { message?: { content?: string | null } }[] },
  locale: Locale,
): ParsedResponse | NextResponse {
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json(
      { error: locale === "ko" ? "AI 응답이 비어 있습니다." : "Empty AI response." },
      { status: 502 },
    );
  }
  const parsed = JSON.parse(content) as ParsedResponse & { personalityTags?: unknown };
  if (!parsed.personalityType || !parsed.personalitySummary || !parsed.letter) {
    return NextResponse.json(
      {
        error:
          locale === "ko" ? "AI 응답 형식이 올바르지 않습니다." : "Invalid AI response shape.",
      },
      { status: 502 },
    );
  }
  parsed.personalityTags = normalizePersonalityTags(parsed.personalityTags, locale);
  return parsed as ParsedResponse;
}

function letterRoleAndStyle(
  locale: Locale,
  petProfile: PetIntroProfile,
  companionName: string,
  favoriteScenery: string,
  mode: LetterMode,
): string {
  const nameLiteral = JSON.stringify(companionName);
  const sceneryLiteral = JSON.stringify(favoriteScenery);
  const addressingBlock = buildLetterAddressingBlock(locale, petProfile, mode);
  if (locale === "ko") {
    return [
      addressingBlock,
      "",
      letterPremiseBlock("ko", mode),
      `아이 이름(편지 속): ${nameLiteral}. h, hj, 'g' 같은 플레이스홀더·이니셜 금지.`,
      `첫 만남·기억 장면은 설문에서 골라 문장 속에 녹여. 장면 힌트: ${sceneryLiteral}`,
      "문체·인칭(엄격): **다정한 반말 하나로 끝까지 통일** (~했어, ~야, ~할게). 해요체만 쓸 거면 처음부터 끝까지 해요체만.",
      "절대 금지: '저희', '귀하', '본인', '너', '너희', '당신', 뉴스·공문체.",
      "어휘: 한자어 위주의 어색한 말·비문 금지(예: 지평 요청, 화져 지낼, 영원히 신뢰 같은 표현). 일상에서 쓰는 쉬운 말만.",
      "personalityType: MBTI 용어·코드 금지. 아이 특징을 살린 **감성 별명 한 줄**만 (예: 꼬리를 흔드는 사랑스러운 친구).",
      "personalitySummary: **편지와 완전히 다른 목소리**로 쓴다. **제3자 관찰자**가 부모에게 아이의 기질을 설명하는 **분석형 문장**(해요체 또는 합니다체로 통일, 반말·1인칭 아이 금지). 설문과 이름·좋아했던 풍경만 근거로, 예시 느낌: 「[이름]은(는) 주변에 기쁨을 주는 일을 큰 행복으로 여겼던 아이예요. 특히 [좋아했던 장소] 같은 개방된 공간에서 에너지를 얻었고, 보호자의 눈빛만으로도 마음을 읽어내는 섬세한 공감을 보였어요.」— 예문을 그대로 복붙하지 말고 실제 설문 문장으로 채울 것. 3~6문장.",
      "personalityTags: **정확히 3개**의 짧은 키워드만 담은 JSON 배열(문자열). 띄어쓰기 없이 2~6자 내외 한 단어 위주. 해시 기호는 있어도 되고 없어도 된다(서버에서 # 정리). 설문에서 읽히는 성향만.",
      "letter는 **오직 1인칭 아이**의 편지: 반말 하나로 통일. personalitySummary·personalityTags와 문체·시점을 섞지 마라.",
      conversationalLetterVoiceRules("ko"),
      "letter 구조: (1) '[수신 호칭], 나 [이름]야' 인사 한 줄. (2) 설문의 구체적 추억·습관을 **한 줄씩** 이어서 말하듯 쓴다. (3) 위 [편지 호칭]의 **마무리 필수 문장**을 그대로 한 번.",
      "letter는 비문·번역투 없이. 영문 한 글자 이름 토큰 금지.",
    ].join("\n");
  }
  return [
    addressingBlock,
    "",
    letterPremiseBlock("en", mode),
    "Ground EVERYTHING in the pet’s real name, favorite scenery, and all five survey answers—especially bright, happy moments. Never invent facts.",
    `The pet’s name in prose must match this exact string (character-for-character): ${nameLiteral}. Never print placeholders, code fragments, or stray initials such as h or hj in quotes—only this name when you mean the pet.`,
    `Turn ${sceneryLiteral} and the answers into felt scenes: sun on fur, the sound of their voice calling you, the smell of the park, hands petting you—simple words, not labels pasted into sentences.`,
    "Diction: avoid academic or formal English—no “embodying moments,” “manifested,” “commenced,” “dearest companion.” Prefer remembering, felt, stayed with you, always close, little things we did.",
    "Use contractions wherever a real voice would (I'm, you're, we've, it's, that's, wasn't). Short sentences beat long polished ones.",
    "Openings: never “Dearest friend” or distant formal address. Prefer “Hi Mom, it’s me,” “Hi Dad, it’s me,” or “Hi Mom and Dad, it’s me,” plus the pet name from the data. If that truly doesn’t fit the survey, use “My dearest Mom,” “My dearest Dad,” or “My favorite human”—still warm and close, never cold.",
    "personalityType: one sweet nickname only—plain and intuitive (e.g. “Your Happy Sunshine”). No MBTI codes.",
    "personalitySummary: MUST differ from the letter’s voice. Write as a **warm third-person observer** (like a gentle temperament note for parents)—not the pet speaking. Use clear, grounded sentences from the survey only (energy, habits, favorite place, how they showed love). No “I/me” as the pet here. Two to four sentences.",
    "personalityTags: a JSON array of **exactly three** short single-word or two-word tags (no spaces inside a tag). Reflect survey traits only. # optional; server normalizes.",
    "letter field ONLY: first-person pet voice with contractions—never reuse the analyst tone from personalitySummary.",
    conversationalLetterVoiceRules("en"),
    "letter structure: (1) Opening with recipient + pet name, one line. (2) Body: survey memories, one thought per line, spoken. (3) Closing + the **required closing sentence** from addressingBlock verbatim.",
    "Never output placeholder one-letter “names” or code-like tokens in any JSON field.",
  ].join("\n");
}

function buildHeroImagePrompt(
  promptFormattedAnswers: string,
  petName: string,
  preferredScenery: string,
  locale: Locale,
): string {
  const style =
    locale === "ko"
      ? "수채화 풍의 따뜻한 빛이 감도는 그림, 부드러운 붓터치와 파스텔 워시, 감성적이고 평온한 분위기."
      : "Warm watercolor illustration, soft brushy washes, pastel tones, gentle golden light, peaceful emotional mood.";
  const scene =
    locale === "ko"
      ? `반려와 보호자가 함께 걷던 추억의 풍경을 연상시키는 장면: ${preferredScenery}. (얼굴 초상 필수 아님, 실루엣·뒷모습·풍경 위주)`
      : `A scene evoking guardian and companion walking together in: ${preferredScenery}. Silhouettes or distant figures OK; focus on place and light.`;
  return [
    style,
    scene,
    "NO text, NO letters, NO watermark, NO logos, NO captions.",
    "Mood notes (do not paint as readable text):",
    promptFormattedAnswers.slice(0, 900),
    `Emotional anchor only — never render as text on canvas: ${petName}`,
  ].join("\n\n");
}

/** 스트리밍 모드: 편지만 평문으로 생성 (JSON 없음) */
function plainLetterSystemPrompt(
  locale: Locale,
  petProfile: PetIntroProfile,
  companionName: string,
  favoriteScenery: string,
  mode: LetterMode,
): string {
  const nameLiteral = JSON.stringify(companionName);
  const sceneryLiteral = JSON.stringify(favoriteScenery);
  const addressingBlock = buildLetterAddressingBlock(locale, petProfile, mode);
  if (locale === "ko") {
    return [
      addressingBlock,
      "",
      letterPremiseBlock("ko", mode),
      `아이 이름(편지 속): ${nameLiteral}.`,
      `기억 장면 힌트: ${sceneryLiteral}`,
      conversationalLetterVoiceRules("ko"),
      "편지는 말로 이어 간다. (1) '[수신 호칭], 나 [이름]야' 인사 한 줄. (2) 설문 답을 한 줄씩 풀어 말한다. (3) 위 [편지 호칭]의 **마무리 필수 문장**을 그대로 한 번.",
      "출력: JSON·제목 없이 편지 본문 평문만. 큰따옴표·코드 블록 금지.",
    ].join("\n");
  }
  return [
    addressingBlock,
    "",
    letterPremiseBlock("en", mode),
    `Pet name in letter: ${nameLiteral}. Scene hint: ${sceneryLiteral}.`,
    conversationalLetterVoiceRules("en"),
    "Speak the letter out loud, one thought per line. End with the **required closing sentence** from [Letter addressing] verbatim.",
    "OUTPUT: Plain text only—no JSON, no code fences.",
  ].join("\n");
}

function plainLetterLanguageInstruction(locale: Locale): string {
  if (locale === "ko") {
    return [
      "편지는 한국어 구어체 반말로만 작성한다. UTF-8 한글·기호만 사용.",
      "한 줄에 한 생각. 줄바꿈으로 호흡. 같은 말 반복·AI식 수식어 나열 금지.",
      "읽는 사람이 '우리 아이가 옆에서 말하는 것 같다'고 느끼게. 교과서·시·광고 같으면 실패.",
      "'너'·'너희'로 상대를 부르지 마.",
      "응답에 stop 시퀀스·메타 지시문을 섞지 마라.",
    ].join("\n");
  }
  return [
    "The letter must be entirely in spoken English—as if talking out loud, not a translator or essay.",
    "One thought per line. Contractions welcome. Ban polished AI prose.",
    "If it reads like an AI essay, you failed.",
    "Address Mom/Dad/their name—not distant 'you'. Include the required closing from the addressing block.",
    "Do not include meta-instructions in the output.",
  ].join("\n");
}

function personalityExtractionSystem(locale: Locale): string {
  if (locale === "ko") {
    return [
      "설문·이름·좋아했던 풍경·편지 본문을 읽고 personalityType, personalitySummary, personalityTags만 JSON으로 출력한다.",
      "Return JSON only with these exact keys: personalityType, personalitySummary, personalityTags.",
      "personalityType: MBTI 용어·코드 금지. 감성 별명 한 줄.",
      "personalitySummary: **제3자 관찰자** 분석 문체(해요체 또는 합니다체로 통일). 아이가 어떤 기질·성향이었는지 객관적이면서 다정하게. 편지와 **시점·문체를 섞지 마라**(편지는 1인칭 아이, 여기는 분석). 설문 사실만 근거. 3~6문장.",
      "personalityTags: 문자열 배열 **길이 정확히 3**. 짧은 키워드(띄어쓰기 없음). 설문 기반.",
      "없는 사실 지어내지 말 것.",
    ].join("\n");
  }
  return [
    "Read the survey, names, scenery, and the letter. Return JSON only with keys: personalityType, personalitySummary, personalityTags.",
    "personalityType: one sweet nickname—no MBTI codes.",
    "personalitySummary: warm **third-person observer** notes for parents—how they tended to feel, connect, and move through the world, grounded in the survey. Not the pet speaking; not first-person.",
    "personalityTags: JSON array of **exactly three** short tags (no spaces inside a tag), survey-grounded.",
    "Do not invent facts.",
  ].join("\n");
}

type PersonalityExtractResult =
  | { ok: true; personalityType: string; personalitySummary: string; personalityTags: string[] }
  | { ok: false; error: string };

async function extractPersonalityFields(
  openai: OpenAI,
  locale: Locale,
  letter: string,
  petName: string,
  preferredScenery: string,
  promptFormattedAnswers: string,
): Promise<PersonalityExtractResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.55,
    max_tokens: 720,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: personalityExtractionSystem(locale) },
      {
        role: "user",
        content: [
          "[편지 본문]",
          letter,
          "",
          "[아이 이름 / Companion name]",
          petName,
          "",
          "[풍경 / Scenery]",
          preferredScenery,
          "",
          "[설문 / Survey]",
          promptFormattedAnswers,
        ].join("\n"),
      },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return {
      ok: false,
      error: locale === "ko" ? "성향 분석 응답이 비어 있습니다." : "Empty personality response.",
    };
  }
  try {
    const parsed = JSON.parse(content) as {
      personalityType?: string;
      personalitySummary?: string;
      personalityTags?: unknown;
    };
    if (!parsed.personalityType?.trim() || !parsed.personalitySummary?.trim()) {
      return {
        ok: false,
        error:
          locale === "ko"
            ? "성향 분석 JSON 형식이 올바르지 않습니다."
            : "Invalid personality JSON shape.",
      };
    }
    const personalityTags = normalizePersonalityTags(parsed.personalityTags, locale);
    return {
      ok: true,
      personalityType: parsed.personalityType.trim(),
      personalitySummary: parsed.personalitySummary.trim(),
      personalityTags,
    };
  } catch {
    return {
      ok: false,
      error:
        locale === "ko" ? "성향 분석 JSON을 파싱하지 못했습니다." : "Could not parse personality JSON.",
    };
  }
}

type SaveProfileResult =
  | { ok: true; letterId: string | null }
  | { ok: false; message: string; retryable: boolean };

/**
 * Supabase 실패를 **진단 가능한 형태로** 남긴다.
 *
 * 예전에는 `error.message` 만 찍었다. 그런데 실제로 원인을 가르는 정보는
 * `code`(예: 23514 CHECK 위반, 42703 없는 컬럼, 42P01 없는 테이블)와
 * `details`·`hint` 에 들어 있다. 그것이 없으면 "저장 실패"라는 문장만 남고
 * 프로덕션에서 무엇이 틀렸는지 알 수 없다 — 실제로 그 상태로 답변 유실이
 * 오래 방치됐다.
 *
 * ⚠️ 서버 로그 전용이다. 이 내용은 브라우저로 절대 내보내지 않는다.
 *    (키·URL 은 애초에 담지 않는다 — 담을 이유가 없다.)
 */
function logSupabaseFailure(
  stage: string,
  error: { message?: string; code?: string; details?: string; hint?: string },
  context: Record<string, unknown>,
): void {
  console.error(
    `[generate-letter] Supabase 실패 — stage=${stage} code=${error.code ?? "-"} ` +
      `message=${error.message ?? "-"} details=${error.details ?? "-"} hint=${error.hint ?? "-"} ` +
      `context=${JSON.stringify(context)}`,
  );
}

/**
 * 저장된 편지의 letter_id (Eternal Beam 핸드오프의 source_letter_id).
 *
 * **읽기 전용이고, 실패해도 저장을 되돌리지 않는다.** migration_add_letter_identity.sql
 * 이 아직 적용되지 않은 환경에서는 컬럼이 없어 이 조회가 실패한다. 그때 저장 전체를
 * 실패로 만들면 배포와 마이그레이션의 순서가 어긋나는 것만으로 편지가 유실된다.
 * 그래서 null 로 물러선다 — 편지는 정상 저장되고, 핸드오프만 아직 제공되지 않는다.
 */
async function fetchLetterId(
  supabase: SupabaseClient,
  userEmail: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("soul_trace_profiles")
    .select("letter_id")
    .eq("user_email", userEmail)
    .maybeSingle();

  if (error) {
    logSupabaseFailure("letter_id read-back", error, { userEmail });
    return null;
  }
  const value = data?.letter_id;
  if (typeof value !== "string" || value.trim().length === 0) {
    // 행은 저장됐는데 letter_id 를 못 읽었다. 마이그레이션이 적용된 환경에서는
    // letter_id 가 NOT NULL + DEFAULT 라 일어날 수 없다 — 일어났다면 스키마가
    // 예상과 다르다는 뜻이므로 조용히 넘기지 않는다. 핸드오프는 불가능해진다.
    console.error(
      `[generate-letter] 저장은 됐으나 letter_id 가 비었다 — user=${userEmail}. ` +
        `핸드오프 CTA 가 뜨지 않는다. soul_trace_profiles.letter_id 스키마를 확인하라.`,
    );
    return null;
  }
  return value;
}

async function saveProfileAndAnswersOnce(
  locale: Locale,
  userEmail: string,
  petName: string,
  preferredScenery: string,
  personalityType: string,
  letter: string,
  heroImageUrl: string | null,
  answers: AnswerInput[],
  options: { includeHeroImage: boolean; partnerId: string | null },
): Promise<SaveProfileResult> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        locale === "ko"
          ? "Supabase 환경 변수가 설정되지 않았습니다."
          : "Supabase environment variables are not configured.",
      retryable: false,
    };
  }

  const profileRow: Record<string, string | null> = {
    user_email: userEmail,
    pet_name: petName,
    personality_type: personalityType,
    generated_letter: letter,
    preferred_scenery: preferredScenery,
  };
  if (options.includeHeroImage) {
    profileRow.hero_image_url = heroImageUrl;
  }
  // 귀속이 확정된 경우에만 쓴다. NULL(직접 유입)이면 컬럼을 아예 보내지 않아,
  // 재생성 시 기존 귀속을 실수로 지우지 않는다 — 첫 유입 경로가 정본이다.
  if (options.partnerId) {
    profileRow.partner_id = options.partnerId;
  }

  const { error: profileError } = await supabase
    .from("soul_trace_profiles")
    .upsert(profileRow, { onConflict: "user_email" });

  if (profileError) {
    const msg = profileError.message;
    logSupabaseFailure("profile upsert", profileError, {
      userEmail,
      columns: Object.keys(profileRow),
    });
    return {
      ok: false,
      message:
        locale === "ko"
          ? `프로필 저장 중 오류가 발생했습니다: ${msg}`
          : `Could not save profile: ${msg}`,
      retryable: isRetryableSupabaseMessage(msg),
    };
  }

  const answerRows = answers.map((item, index) => ({
    user_email: userEmail,
    answer_order: index + 1,
    question: item.question,
    answer: item.answer,
  }));

  const { error: deleteError } = await supabase
    .from("soul_trace_answers")
    .delete()
    .eq("user_email", userEmail);
  if (deleteError) {
    const msg = deleteError.message;
    logSupabaseFailure("answers delete", deleteError, { userEmail });
    return {
      ok: false,
      message:
        locale === "ko"
          ? `기존 답변 정리 중 오류가 발생했습니다: ${msg}`
          : `Could not reset previous answers: ${msg}`,
      retryable: isRetryableSupabaseMessage(msg),
    };
  }

  const { error: answerSaveError } = await supabase.from("soul_trace_answers").insert(answerRows);
  if (answerSaveError) {
    const msg = answerSaveError.message;
    logSupabaseFailure("answers insert", answerSaveError, {
      userEmail,
      rowCount: answerRows.length,
      answerOrders: answerRows.map((r) => r.answer_order),
    });
    return {
      ok: false,
      message:
        locale === "ko"
          ? `답변 저장 중 오류가 발생했습니다: ${msg}`
          : `Could not save answers: ${msg}`,
      retryable: isRetryableSupabaseMessage(msg),
    };
  }

  // 저장이 끝난 뒤에 **따로** 읽는다. upsert 문에 .select() 를 붙이지 않는 이유는,
  // 마이그레이션 전 환경에서 그 한 줄이 쓰기 자체를 실패시키기 때문이다.
  // 여기서는 실패해도 null 이 되고 편지는 이미 저장돼 있다.
  return { ok: true, letterId: await fetchLetterId(supabase, userEmail) };
}

async function saveProfileAndAnswers(
  locale: Locale,
  userEmail: string,
  petName: string,
  preferredScenery: string,
  personalityType: string,
  letter: string,
  heroImageUrl: string | null,
  answers: AnswerInput[],
  partnerId: string | null,
): Promise<SaveProfileResult> {
  const attempts = [
    { includeHeroImage: true, partnerId },
    { includeHeroImage: true, partnerId },
    { includeHeroImage: false, partnerId },
  ] as const;

  let last: SaveProfileResult = {
    ok: false,
    message: locale === "ko" ? "저장에 실패했습니다." : "Could not save.",
    retryable: false,
  };

  for (let i = 0; i < attempts.length; i++) {
    last = await saveProfileAndAnswersOnce(
      locale,
      userEmail,
      petName,
      preferredScenery,
      personalityType,
      letter,
      heroImageUrl,
      answers,
      attempts[i]!,
    );
    if (last.ok) return last;
    if (!last.retryable || i === attempts.length - 1) return last;
    await sleep(500 * (i + 1));
  }

  return last;
}

function saveFailureResponse(locale: Locale, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

function scheduleGoogleSheetsIngest(args: {
  locale: Locale;
  userEmail: string;
  petName: string;
  preferredScenery: string;
  personalityType: string;
  personalitySummary: string;
  personalityTags: unknown;
  heroImageUrl: string | null;
  letter: string;
  answers: AnswerInput[];
}) {
  after(() => {
    const tags = Array.isArray(args.personalityTags)
      ? args.personalityTags.map((t) => String(t)).join(" · ")
      : "";
    void appendSoulTraceToGoogleSheets({
      locale: args.locale,
      userEmail: args.userEmail,
      petName: args.petName,
      preferredScenery: args.preferredScenery,
      personalityType: args.personalityType,
      personalitySummary: args.personalitySummary,
      personalityTags: tags,
      heroImageUrl: args.heroImageUrl,
      letterPreview: args.letter,
      answersJson: JSON.stringify(
        args.answers.map((a) => ({ question: a.question, answer: a.answer })),
      ),
    });
  });
}

function sseEncode(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const locale: Locale = body.locale === "en" ? "en" : "ko";
    const mode: LetterMode = isLetterMode(body.mode) ? body.mode : DEFAULT_LETTER_MODE;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: friendlyGenerateError(locale) }, { status: 503 });
    }

    const userEmail = body.userEmail?.trim().toLowerCase() ?? "";
    const petProfile = parsePetProfileFromBody(body);
    const privacyConsent = body.privacyConsent ?? false;
    const answers = body.answers ?? [];
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);

    if (!isEmailValid) {
      return err(locale, "invalidEmail", 400);
    }
    if (!petProfile) {
      return err(locale, "profileIncomplete", 400);
    }
    if (
      (petProfile.letterRecipient === "byName" || petProfile.letterRecipient === "custom") &&
      !petProfile.letterRecipientDetail.trim()
    ) {
      return err(locale, "profileIncomplete", 400);
    }
    if (!privacyConsent) {
      return err(locale, "privacyRequired", 400);
    }

    // 파트너 귀속은 **서버가** 정한다. 코드가 틀렸거나 꺼졌으면 조용히 null —
    // 편지 생성을 막지 않는다(고객 잘못이 아니다). 틀린 귀속보다 없는 귀속이 낫다.
    let partnerId: string | null = null;
    {
      const sb = createSupabaseServerClient();
      if (sb) {
        const partner = await resolvePartnerCode(sb, body.partnerCode);
        partnerId = partner?.partnerId ?? null;
        if (body.partnerCode && !partner) {
          console.warn("[generate-letter] 알 수 없거나 비활성인 파트너 코드 — 귀속 없이 진행");
        }
      }
    }

    const tonePrefs = parseTonePrefs(body);
    if (!tonePrefs) {
      return err(locale, "profileIncomplete", 400);
    }
    const petName = petProfile.petName;
    const letterName = letterPetName(petProfile);
    const preferredScenery = body.preferredScenery?.trim() || sceneryFallback(locale, answers);
    const profilePromptBlock = buildPetProfilePromptBlock(locale, petProfile, mode);
    const tonePromptBlock = buildTonePromptBlock(
      locale,
      tonePrefs,
      locale === "ko" ? ko : en,
      mode,
    );

    if (!Array.isArray(answers) || answers.length !== 8) {
      return NextResponse.json(
        { error: locale === "ko" ? "질문 답변 8개가 필요합니다." : "Eight answers are required." },
        { status: 400 },
      );
    }

    for (let i = 0; i < 4; i++) {
      if (!answers[i]?.answer?.trim()) {
        return NextResponse.json(
          { error: locale === "ko" ? "기억 질문(Q5–Q8)을 모두 입력해 주세요." : "Please answer memory questions Q5–Q8." },
          { status: 400 },
        );
      }
    }

    const promptFormattedAnswers = answers
      .map((item, index) => {
        const q = clampPromptField(item.question, PROMPT_Q_MAX);
        const a = clampPromptField(item.answer, PROMPT_A_MAX);
        return `${index + 1}. Q: ${q}\nA: ${a}`;
      })
      .join("\n\n");

    let hasSavedLetter = false;
    const supabaseGate = createSupabaseServerClient();
    if (supabaseGate) {
      const { data: existingProfile, error: gateError } = await supabaseGate
        .from("soul_trace_profiles")
        .select("generated_letter")
        .eq("user_email", userEmail)
        .maybeSingle();
      if (gateError) {
        console.error("[generate-letter] duplicate check skipped:", gateError.message);
      } else {
        hasSavedLetter = Boolean(
          existingProfile?.generated_letter &&
            String(existingProfile.generated_letter).trim().length > 0,
        );
      }
    }
    /** 언어 전환만: stream 없음 + skipImageGeneration — 기존 편지·배경 유지한 채 문구만 다시 생성 */
    const isLanguageRerunOnly =
      body.skipImageGeneration === true && body.stream !== true;
    if (hasSavedLetter && !isLanguageRerunOnly) {
      return err(locale, "alreadyGenerated", 403);
    }

    const languageInstruction =
      locale === "ko"
        ? [
            "필수: personalityType, personalitySummary, personalityTags, letter 네 필드는 모두 한국어로만 작성한다. 설문 답이 영어여도 네 필드는 한국어로 서술한다.",
            "출력은 유효한 UTF-8 한글·기호만 사용하고, JSON 문자열 안에서 줄이 중간에 끊기지 않게 완전한 문장으로 마무리한다.",
            "letter만 1인칭 아이 대화 톤. personalitySummary는 제3자 분석 문체만.",
            "letter: '[수신 호칭], 나 [이름]야'로 시작. 상대는 엄마·아빠 등 호칭만—'너'·'너희' 금지.",
            "letter는 말로 하는 대화 — 한 줄에 생각 하나, 설문 답을 빠짐없이 풀어 쓴다. AI·시·광고 문체 금지.",
            "letter 길이는 [편지 톤] 블록을 따른다. 마무리에 [편지 호칭]의 필수 문장을 그대로 한 번.",
            "응답에 stop 시퀀스 문자열이나 메타 지시문을 섞어 넣지 마라.",
          ].join("\n")
        : [
            "MANDATORY: personalityType, personalitySummary, personalityTags, and letter must be entirely in natural English.",
            "letter: first-person spoken voice—open with recipient + pet name. Address Mom/Dad/their name, not distant 'you'. Conversation, not an AI essay.",
            "personalitySummary: third-person gentle analyst for parents—not the pet speaking; no first-person pet voice there.",
            "personalityTags: JSON array of exactly three short tags.",
            "One thought per line. Weave every answered survey memory. Length follows the [Letter tone] block. End with the required closing from [Letter addressing] verbatim.",
            "Do not include meta-instructions or stop-sequence markers in the output.",
          ].join("\n");

    const openai = new OpenAI({ apiKey });

    const userPayload =
      locale === "ko"
        ? [
            "Return JSON only with these exact keys: personalityType, personalitySummary, personalityTags, letter.",
            "",
            profilePromptBlock,
            "",
            tonePromptBlock,
            "",
            "[아이 이름 — 편지에서 자연스럽게 부를 것 (애칭 우선)]",
            letterName,
            "",
            "[보호자가 적어 준, 아이가 사랑했던 풍경·장소 — 분위기와 은유에 반영할 것]",
            preferredScenery,
            "",
            "[설문 8문항과 답변 — 편지의 **유일한** 근거. 기억 답을 빠짐없이 대화에 녹여 쓸 것. 없는 일은 짓지 말 것]",
            promptFormattedAnswers,
          ].join("\n")
        : [
            "Return JSON only with these exact keys: personalityType, personalitySummary, personalityTags, letter.",
            "",
            profilePromptBlock,
            "",
            tonePromptBlock,
            "",
            "[Companion’s name — use naturally in the letter (nickname first)]",
            letterName,
            "",
            "[Scenery or place they loved — reflect in mood and metaphor]",
            preferredScenery,
            "",
            "[Eight survey Q&As — the letter's **only** facts. Weave every answered memory. Invent nothing.]",
            promptFormattedAnswers,
          ].join("\n");

    const skipImageGeneration = body.skipImageGeneration === true;
    const existingHeroImageUrl =
      typeof body.existingHeroImageUrl === "string" && body.existingHeroImageUrl.trim().length > 0
        ? body.existingHeroImageUrl.trim()
        : null;

    if (body.stream === true) {
      const userLetterPayload =
        locale === "ko"
          ? [
              profilePromptBlock,
              "",
              tonePromptBlock,
              "",
              "[아이 이름 — 편지에서 자연스럽게 부를 것 (애칭 우선)]",
              letterName,
              "",
              "[보호자가 적어 준, 아이가 사랑했던 풍경·장소 — 분위기와 은유에 반영할 것]",
              preferredScenery,
              "",
              "[설문 8문항과 답변 — 편지의 **유일한** 근거. 기억 답을 빠짐없이 대화에 녹여 쓸 것. 없는 일은 짓지 말 것]",
              promptFormattedAnswers,
            ].join("\n")
          : [
              profilePromptBlock,
              "",
              tonePromptBlock,
              "",
              "[Companion’s name — use naturally in the letter (nickname first)]",
              letterName,
              "",
              "[Scenery or place they loved — reflect in mood and metaphor]",
              preferredScenery,
              "",
              "[Eight survey Q&As — the letter's **only** facts. Weave every answered memory. Invent nothing.]",
              promptFormattedAnswers,
            ].join("\n");

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (payload: unknown) => {
            controller.enqueue(sseEncode(payload));
          };
          try {
            let heroImageUrl: string | null = null;
            let heroImageSkipped = false;

            const imageTask = (async () => {
              if (skipImageGeneration) {
                heroImageUrl = existingHeroImageUrl;
                heroImageSkipped = !heroImageUrl;
                send({ type: "hero", heroImageUrl, heroImageSkipped });
                return;
              }
              if (envSkipsHeroImage()) {
                heroImageUrl = null;
                heroImageSkipped = true;
                send({ type: "hero", heroImageUrl: null, heroImageSkipped: true });
                return;
              }
              try {
                const imagePrompt = buildHeroImagePrompt(
                  promptFormattedAnswers,
                  letterName,
                  preferredScenery,
                  locale,
                );
                const img = await openai.images.generate({
                  model: "dall-e-3",
                  prompt: imagePrompt,
                  n: 1,
                  size: "1024x1024",
                  quality: "standard",
                });
                const url = img.data?.[0]?.url ?? null;
                heroImageUrl = url;
                heroImageSkipped = !url;
                send({ type: "hero", heroImageUrl: url, heroImageSkipped: !url });
              } catch {
                heroImageUrl = null;
                heroImageSkipped = true;
                send({ type: "hero", heroImageUrl: null, heroImageSkipped: true });
              }
            })();

            const letterStream = await openai.chat.completions.create({
              model: "gpt-4o",
              temperature: 0.85,
              frequency_penalty: 0.28,
              max_tokens: 2200,
              stream: true,
              messages: [
                {
                  role: "system",
                  content: [
                    plainLetterSystemPrompt(
                      locale,
                      petProfile,
                      letterName,
                      preferredScenery,
                      mode,
                    ),
                    plainLetterLanguageInstruction(locale),
                  ].join("\n\n"),
                },
                { role: "user", content: userLetterPayload },
              ],
            });

            let fullLetter = "";
            for await (const chunk of letterStream) {
              const delta = chunk.choices[0]?.delta?.content ?? "";
              if (delta) {
                fullLetter += delta;
                send({ type: "letter", delta });
              }
            }

            const trimmedLetter = fullLetter.trim();
            if (!trimmedLetter) {
              send({ type: "error", message: friendlyGenerateError(locale) });
              controller.close();
              return;
            }

            await imageTask;

            const personality = await extractPersonalityFields(
              openai,
              locale,
              trimmedLetter,
              letterName,
              preferredScenery,
              promptFormattedAnswers,
            );
            if (!personality.ok) {
              send({ type: "error", message: friendlyGenerateError(locale) });
              controller.close();
              return;
            }

            const saveResult = await saveProfileAndAnswers(
              locale,
              userEmail,
              petName,
              preferredScenery,
              personality.personalityType,
              trimmedLetter,
              heroImageUrl,
              answers,
              partnerId,
            );
            if (!saveResult.ok) {
              // **성공인 척하지 않는다.** 여기서 조용히 넘어가면 사용자는 완벽한
              // 편지를 보고, 서버에는 아무것도 남지 않는다 — 편지를 되찾을 방법도,
              // Eternal Beam 으로 넘길 방법도 사라진다. 실제로 그 상태였다.
              console.error(
                `[generate-letter] 저장 최종 실패 — user=${userEmail} ` +
                  `retryable=${saveResult.retryable} message=${saveResult.message}`,
              );
            } else {
              scheduleGoogleSheetsIngest({
                locale,
                userEmail,
                petName,
                preferredScenery,
                personalityType: personality.personalityType,
                personalitySummary: personality.personalitySummary,
                personalityTags: personality.personalityTags,
                heroImageUrl,
                letter: trimmedLetter,
                answers,
              });
            }

            send({
              type: "done",
              personalityType: personality.personalityType,
              personalitySummary: personality.personalitySummary,
              personalityTags: personality.personalityTags,
              letter: trimmedLetter,
              heroImageUrl,
              heroImageSkipped,
              savedPetName: letterName,
              persistenceFailed: !saveResult.ok,
              // Eternal Beam 핸드오프의 source_letter_id. 저장이 실패했거나
              // 마이그레이션 전이면 null 이다 — 편지 표시는 그대로 동작한다.
              letterId: saveResult.ok ? saveResult.letterId : null,
            });
            controller.close();
          } catch {
            send({ type: "error", message: friendlyGenerateError(locale) });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const letterPromise = openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.85,
      frequency_penalty: 0.28,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            letterRoleAndStyle(locale, petProfile, letterName, preferredScenery, mode),
            languageInstruction,
          ].join(
            "\n\n",
          ),
        },
        {
          role: "user",
          content: userPayload,
        },
      ],
    });

    let parsed: ParsedResponse;
    let heroImageUrl: string | null = null;
    let heroImageSkipped = false;

    if (skipImageGeneration) {
      let completion: Awaited<typeof letterPromise>;
      try {
        completion = await letterPromise;
      } catch (reason) {
        throw reason;
      }
      const maybeParsed = parseLetterCompletion(completion, locale);
      if (maybeParsed instanceof NextResponse) return maybeParsed;
      parsed = maybeParsed;
      heroImageUrl = existingHeroImageUrl;
      heroImageSkipped = !heroImageUrl;
    } else if (envSkipsHeroImage()) {
      let completion: Awaited<typeof letterPromise>;
      try {
        completion = await letterPromise;
      } catch (reason) {
        throw reason;
      }
      const maybeParsed = parseLetterCompletion(completion, locale);
      if (maybeParsed instanceof NextResponse) return maybeParsed;
      parsed = maybeParsed;
      heroImageUrl = null;
      heroImageSkipped = true;
    } else {
      const imagePrompt = buildHeroImagePrompt(
        promptFormattedAnswers,
        letterName,
        preferredScenery,
        locale,
      );
      const imagePromise = openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      const [letterSettled, imageSettled] = await Promise.allSettled([letterPromise, imagePromise]);

      if (letterSettled.status === "rejected") {
        throw letterSettled.reason;
      }

      const completion = letterSettled.value;
      const maybeParsed = parseLetterCompletion(completion, locale);
      if (maybeParsed instanceof NextResponse) return maybeParsed;
      parsed = maybeParsed;

      if (imageSettled.status === "fulfilled") {
        const rows = imageSettled.value.data;
        const url = rows?.[0]?.url;
        heroImageUrl = url ?? null;
        if (!heroImageUrl) {
          heroImageSkipped = true;
        }
      } else {
        heroImageSkipped = true;
      }
    }

    const saveResult = await saveProfileAndAnswers(
      locale,
      userEmail,
      petName,
      preferredScenery,
      parsed.personalityType,
      parsed.letter,
      heroImageUrl,
      answers,
      partnerId,
    );
    if (!saveResult.ok) {
      return saveFailureResponse(locale, saveResult.message);
    }

    scheduleGoogleSheetsIngest({
      locale,
      userEmail,
      petName,
      preferredScenery,
      personalityType: parsed.personalityType,
      personalitySummary: parsed.personalitySummary,
      personalityTags: parsed.personalityTags,
      heroImageUrl,
      letter: parsed.letter,
      answers,
    });

    return new NextResponse(
      JSON.stringify({
        ...parsed,
        heroImageUrl,
        heroImageSkipped,
        savedPetName: letterName,
        persistenceFailed: false,
        // Eternal Beam 핸드오프의 source_letter_id. 마이그레이션 전이면 null 이다.
        letterId: saveResult.letterId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  } catch {
    return NextResponse.json({ error: friendlyGenerateError("ko") }, { status: 500 });
  }
}
