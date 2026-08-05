import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import type { Locale } from "@/lib/i18n";
import { normalizePersonalityTags } from "@/lib/normalize-personality-tags";
import OpenAI from "openai";
import { appendSoulTraceToGoogleSheets } from "@/lib/google-sheets-ingest";
import {
  createSupabaseServerClient,
  isRetryableSupabaseMessage,
  sleep,
} from "@/lib/supabase-server";
import { after } from "next/server";
import { NextResponse } from "next/server";

type AnswerInput = {
  question: string;
  answer: string;
};

type RequestBody = {
  locale?: string;
  userEmail?: string;
  petName?: string;
  preferredScenery?: string;
  privacyConsent?: boolean;
  answers?: AnswerInput[];
  /** 언어 전환 등 텍스트만 다시 생성할 때 — 배경 이미지 API 호출 생략 */
  skipImageGeneration?: boolean;
  existingHeroImageUrl?: string | null;
  /** 첫 생성: 편지를 SSE로 스트리밍 (이미지는 병렬로 진행) */
  stream?: boolean;
};

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
const PROMPT_A_MAX = 280;

function clampPromptField(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function err(locale: Locale, key: keyof typeof ko.errors, status: number) {
  return NextResponse.json({ error: ERR[locale][key] }, { status });
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

/** letter 필드만: AI·에세이 티를 빼고 어린이 편지처럼 */
function childlikeLetterVoiceRules(locale: Locale): string {
  if (locale === "ko") {
    return [
      "letter 문체(가장 중요) — ChatGPT·시·수필·광고 카피가 아니라, **다 큰 아이가 엄마·아빠에게 직접 쓴 손편지**처럼:",
      "- 짧은 문장 위주. 한 문장에 생각 하나. 가끔 '그때…' '아, 맞다.'처럼 말하다 멈추는 호흡도 괜찮아.",
      "- 쉬운 말·구어체만: '진짜', '엄청', '조금', '막', '그거 알지?' — 한자어·문어체·'～함으로써'·'깊은 감사를 전합니다' 금지.",
      "- 감정은 돌려 말하지 말고 툭: '그래서 나 그때 진짜 좋았어.' '가끔 그립기도 해.'",
      "- 완벽한 서론-본론-결론·대칭·교훈적 마무리 금지. 초등 고학년 일기처럼 다정하고 솔직하게.",
      "- '따뜻한', '소중한 순간', '영원히 기억할', '깊은 사랑', '항상 곁에' 같은 **뻔한 AI 감성 멘트** 나열 금지. 대신 설문에서 골라 **냄새·소리·손길·습관 하나**를 구체적으로 말하기.",
      "- 맞춤법은 대체로 맞되, 문장이 너무 매끄럽고 문학적이면 안 됨. 어색한 완벽함보다 살아 있는 말투.",
      "- 이모티콘·ㅋㅋ·과한 맞춤법 실수는 쓰지 마.",
    ].join("\n");
  }
  return [
    "letter voice (critical) — NOT an essay, poem, or ad. Sound like a **sweet, slightly older kid** writing to Mom/Dad:",
    "- Short, simple sentences. One thought at a time. OK to trail off: 'That day…' 'Oh, right.'",
    "- Everyday kid words only—no literary flourishes, no 'hereby', 'profound', 'cherished', 'forever grateful'.",
    "- Say feelings plainly: 'I really loved that.' 'I miss it sometimes.'",
    "- No perfect intro-body-conclusion symmetry or moral-of-the-story ending.",
    "- Ban cliché AI lines: 'precious moments', 'deeply touched', 'always by your side'. Pick one concrete smell, sound, or touch from the survey instead.",
    "- Slightly imperfect flow beats polished prose. Warm and honest beats elegant.",
    "- No emojis or text-speak.",
  ].join("\n");
}

function letterRoleAndStyle(
  locale: Locale,
  companionName: string,
  favoriteScenery: string,
): string {
  const nameLiteral = JSON.stringify(companionName);
  const sceneryLiteral = JSON.stringify(favoriteScenery);
  if (locale === "ko") {
    return [
      "역할: 무지개다리 너머에서 엄마·아빠에게 직접 말하는 반려견이야. 입력된 반려 이름·좋아했던 풍경·설문(특히 가장 밝았던 에너지·순간)만 근거로 쓴다. 없는 일은 지어내지 마.",
      `반려 이름은 반드시 이 문자열만: ${nameLiteral}. h, hj, 'g' 같은 플레이스홀더·이니셜 금지.`,
      `좋아했던 장소·풍경과 밝았던 순간은 꼭 문장 속에 조사까지 붙여 자연스럽게 녹여. (예시 느낌: 경안천 산책로에서 우리 같이 뛰던 때 기억나? — 실제 답의 장소·장면을 쓰고, 이 예문을 그대로 복붙하지 마.) 장소 힌트: ${sceneryLiteral}`,
      "문체·인칭(엄격): 아이가 엄마·아빠에게 말하듯 **다정한 반말 하나로 끝까지 통일** (~했어, ~야, ~할게, ~거야 등). 해요체만 쓸 거면 처음부터 끝까지 해요체만. 반말과 해요체를 섞지 마.",
      "절대 금지: '저희', '귀하', '본인', '상기', 뉴스·공문체. '나', '우리', '엄마', '아빠'는 자연스럽게 써도 돼.",
      "어휘: 한자어 위주의 어색한 말·비문 금지(예: 지평 요청, 화져 지낼, 영원히 신뢰 같은 표현). 일상에서 쓰는 쉬운 말만.",
      "personalityType: MBTI 용어·코드 금지. 아이 특징을 살린 **감성 별명 한 줄**만 (예: 꼬리를 흔드는 사랑스러운 친구).",
      "personalitySummary: **편지와 완전히 다른 목소리**로 쓴다. **제3자 관찰자**가 부모에게 아이의 기질을 설명하는 **분석형 문장**(해요체 또는 합니다체로 통일, 반말·1인칭 아이 금지). 설문과 이름·좋아했던 풍경만 근거로, 예시 느낌: 「[이름]은(는) 주변에 기쁨을 주는 일을 큰 행복으로 여겼던 아이예요. 특히 [좋아했던 장소] 같은 개방된 공간에서 에너지를 얻었고, 보호자의 눈빛만으로도 마음을 읽어내는 섬세한 공감을 보였어요.」— 예문을 그대로 복붙하지 말고 실제 설문 문장으로 채울 것. 3~6문장.",
      "personalityTags: **정확히 3개**의 짧은 키워드만 담은 JSON 배열(문자열). 띄어쓰기 없이 2~6자 내외 한 단어 위주. 해시 기호는 있어도 되고 없어도 된다(서버에서 # 정리). 설문에서 읽히는 성향만.",
      "letter는 **오직 1인칭 아이**의 편지: 반말 또는 해요체 하나로 통일. personalitySummary·personalityTags와 문체·시점을 섞지 마라.",
      childlikeLetterVoiceRules("ko"),
      "letter는 한 통으로 이어 써. (1) 반가운 인사 + 그때 풍경·공기 짧게. (2) 설문에 나온 고마웠던 순간·습관·손길. (3) 지금 편하다는 안심 + 반드시 **'언제든 빛으로 너를 찾아갈게'** 문장을 그대로 한 번.",
      "letter는 비문·번역투 없이. 영문 한 글자 이름 토큰 금지.",
    ].join("\n");
  }
  return [
    "You are a beloved pet writing a letter from Rainbow Bridge to your owner. The tone must be incredibly warm, personal, and simple—like a gentle whisper, never a stiff essay or marketing copy.",
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
    childlikeLetterVoiceRules("en"),
    "letter structure: (1) Opening: “Hi Mom/Dad, it’s me, [petName]” (pick Mom, Dad, or Mom and Dad to match the vibe of the answers; keep the name exactly as given). (2) Body: reminisce about the favorite place and the little routines you loved—only what the answers support. (3) Closing: you’re okay now, still near them—simple kid words, not an ad.",
    "Somewhere in the final sentences of letter, you MUST include this exact sentence, word for word including the period: I'll always find you through the light.",
    "After that required sentence, you may end with a simple sign-off such as “I'm still here, shining for you. Love always, [petName]” if it flows naturally—keep the pet name exact.",
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
  companionName: string,
  favoriteScenery: string,
): string {
  const nameLiteral = JSON.stringify(companionName);
  const sceneryLiteral = JSON.stringify(favoriteScenery);
  if (locale === "ko") {
    return [
      "역할: 무지개다리 너머에서 엄마·아빠에게 직접 말하는 반려견이야. 입력된 반려 이름·좋아했던 풍경·설문(특히 가장 밝았던 에너지·순간)만 근거로 쓴다. 없는 일은 지어내지 마.",
      `반려 이름은 반드시 이 문자열만: ${nameLiteral}. h, hj, 'g' 같은 플레이스홀더·이니셜 금지.`,
      `좋아했던 장소·풍경과 밝았던 순간은 꼭 문장 속에 조사까지 붙여 자연스럽게 녹여. (예시 느낌: 경안천 산책로에서 우리 같이 뛰던 때 기억나? — 실제 답의 장소·장면을 쓰고, 이 예문을 그대로 복붙하지 마.) 장소 힌트: ${sceneryLiteral}`,
      "문체·인칭(엄격): 아이가 엄마·아빠에게 말하듯 **다정한 반말 하나로 끝까지 통일** (~했어, ~야, ~할게, ~거야 등). 해요체만 쓸 거면 처음부터 끝까지 해요체만. 반말과 해요체를 섞지 마.",
      "절대 금지: '저희', '귀하', '본인', '상기', 뉴스·공문체. '나', '우리', '엄마', '아빠'는 자연스럽게 써도 돼.",
      "어휘: 한자어 위주의 어색한 말·비문 금지(예: 지평 요청, 화져 지낼, 영원히 신뢰 같은 표현). 일상에서 쓰는 쉬운 말만.",
      childlikeLetterVoiceRules("ko"),
      "편지는 한 통으로 이어 써. (1) 반가운 인사 + 그때 풍경·공기 짧게. (2) 설문에 나온 고마웠던 순간·습관·손길. (3) 지금 편하다는 안심 + 반드시 **'언제든 빛으로 너를 찾아갈게'** 문장을 그대로 한 번.",
      "비문·번역투 없이. 영문 한 글자 이름 토큰 금지.",
      "출력 형식(엄격): JSON을 쓰지 마라. 제목 줄 없이 인사로 바로 시작하는 **편지 본문 평문만** 출력한다. 전체를 큰따옴표로 감싸지 마라. 코드 블록도 쓰지 마라.",
    ].join("\n");
  }
  return [
    "You are a beloved pet writing a letter from Rainbow Bridge to your owner. The tone must be incredibly warm, personal, and simple—like a gentle whisper, never a stiff essay or marketing copy.",
    "Ground EVERYTHING in the pet’s real name, favorite scenery, and all five survey answers—especially bright, happy moments. Never invent facts.",
    `The pet’s name in prose must match this exact string (character-for-character): ${nameLiteral}. Never print placeholders, code fragments, or stray initials such as h or hj in quotes—only this name when you mean the pet.`,
    `Turn ${sceneryLiteral} and the answers into felt scenes: sun on fur, the sound of their voice calling you, the smell of the park, hands petting you—simple words, not labels pasted into sentences.`,
    "Diction: avoid academic or formal English—no “embodying moments,” “manifested,” “commenced,” “dearest companion.” Prefer remembering, felt, stayed with you, always close, little things we did.",
    "Use contractions wherever a real voice would (I'm, you're, we've, it's, that's, wasn't). Short sentences beat long polished ones.",
    "Openings: never “Dearest friend” or distant formal address. Prefer “Hi Mom, it’s me,” “Hi Dad, it’s me,” or “Hi Mom and Dad, it’s me,” plus the pet name from the data. If that truly doesn’t fit the survey, use “My dearest Mom,” “My dearest Dad,” or “My favorite human”—still warm and close, never cold.",
    childlikeLetterVoiceRules("en"),
    "letter structure: (1) Opening: “Hi Mom/Dad, it’s me, [petName]” (pick Mom, Dad, or Mom and Dad to match the vibe of the answers; keep the name exactly as given). (2) Body: reminisce about the favorite place and the little routines you loved—only what the answers support. (3) Closing: you’re okay now, still near them—simple kid words, not an ad.",
    "Somewhere in the final sentences of the letter, you MUST include this exact sentence, word for word including the period: I'll always find you through the light.",
    "After that required sentence, you may end with a simple sign-off such as “I'm still here, shining for you. Love always, [petName]” if it flows naturally—keep the pet name exact.",
    "Never output placeholder one-letter “names” or code-like tokens.",
    "OUTPUT FORMAT: Plain text only—the letter itself. No JSON, no code fences, no wrapping the whole letter in quotes. Start directly with your greeting.",
  ].join("\n");
}

function plainLetterLanguageInstruction(locale: Locale): string {
  if (locale === "ko") {
    return [
      "편지는 한국어로만 작성한다. UTF-8 한글·기호만 사용.",
      "한국어 기준 대략 380~650자. 짧고 담백하게—같은 말 반복·AI식 수식어 나열은 피한다.",
      "읽는 사람이 '아이가 직접 쓴 것 같다'고 느끼게. 너무 길고 교과서 같으면 실패.",
      "응답에 stop 시퀀스·메타 지시문을 섞지 마라.",
    ].join("\n");
  }
  return [
    "The letter must be entirely in natural English—as the pet’s voice, not a formal translator.",
    "Everyday kid vocabulary; contractions welcome.",
    "About 320–600 characters—short and honest beats long and polished.",
    "If it reads like an AI essay, you failed. It should feel handwritten by a child.",
    "The letter’s closing must contain the exact sentence: I'll always find you through the light. (same spelling and final period).",
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

type SaveProfileResult = { ok: true } | { ok: false; message: string; retryable: boolean };

async function saveProfileAndAnswersOnce(
  locale: Locale,
  userEmail: string,
  petName: string,
  preferredScenery: string,
  personalityType: string,
  letter: string,
  heroImageUrl: string | null,
  answers: AnswerInput[],
  options: { includeHeroImage: boolean },
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

  const { error: profileError } = await supabase
    .from("soul_trace_profiles")
    .upsert(profileRow, { onConflict: "user_email" });

  if (profileError) {
    const msg = profileError.message;
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
    return {
      ok: false,
      message:
        locale === "ko"
          ? `답변 저장 중 오류가 발생했습니다: ${msg}`
          : `Could not save answers: ${msg}`,
      retryable: isRetryableSupabaseMessage(msg),
    };
  }

  return { ok: true };
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
): Promise<SaveProfileResult> {
  const attempts = [
    { includeHeroImage: true },
    { includeHeroImage: true },
    { includeHeroImage: false },
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as RequestBody;
    const locale: Locale = body.locale === "en" ? "en" : "ko";
    const userEmail = body.userEmail?.trim().toLowerCase() ?? "";
    const petName = body.petName?.trim() ?? "";
    const preferredScenery = body.preferredScenery?.trim() ?? "";
    const privacyConsent = body.privacyConsent ?? false;
    const answers = body.answers ?? [];
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);

    if (!isEmailValid) {
      return err(locale, "invalidEmail", 400);
    }
    if (!petName || !preferredScenery) {
      return err(locale, "profileIncomplete", 400);
    }
    if (!privacyConsent) {
      return err(locale, "privacyRequired", 400);
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return NextResponse.json(
        { error: locale === "ko" ? "질문 답변 5개가 필요합니다." : "Five answers are required." },
        { status: 400 },
      );
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
            "letter만 1인칭 아이 편지 톤. personalitySummary는 제3자 분석 문체만.",
            "letter는 어린이가 직접 쓴 손편지처럼—짧은 문장, 쉬운 말, 구체적 추억 하나. AI·시·광고 문체 금지.",
            "letter는 한국어 기준 대략 380~650자. 같은 말 반복·뻔한 감성 멘트 나열은 피한다. max_tokens 한도 안에서 끝까지 문장을 완성한다.",
            "응답에 stop 시퀀스 문자열이나 메타 지시문을 섞어 넣지 마라.",
          ].join("\n")
        : [
            "MANDATORY: personalityType, personalitySummary, personalityTags, and letter must be entirely in natural English.",
            "letter: first-person pet voice—like a sweet child writing to Mom/Dad. Short sentences, plain words, one concrete memory. NOT an essay or ad.",
            "personalitySummary: third-person gentle analyst for parents—not the pet speaking; no first-person pet voice there.",
            "personalityTags: JSON array of exactly three short tags.",
            "Use complete sentences; do not truncate mid-thought. Letter about 320–600 characters—honest and kid-like beats long and polished.",
            "The letter’s closing must contain the exact sentence: I'll always find you through the light. (same spelling and final period).",
            "Do not include meta-instructions or stop-sequence markers in the output.",
          ].join("\n");

    const openai = new OpenAI({ apiKey });

    const userPayload =
      locale === "ko"
        ? [
            "Return JSON only with these exact keys: personalityType, personalitySummary, personalityTags, letter.",
            "",
            "[아이 이름 — 편지에서 자연스럽게 부를 것]",
            petName,
            "",
            "[보호자가 적어 준, 아이가 사랑했던 풍경·장소 — 분위기와 은유에 반영할 것]",
            preferredScenery,
            "",
            "[설문 5문항과 답변 — 성향·편지의 유일한 근거]",
            promptFormattedAnswers,
          ].join("\n")
        : [
            "Return JSON only with these exact keys: personalityType, personalitySummary, personalityTags, letter.",
            "",
            "[Companion’s name — use naturally in the letter]",
            petName,
            "",
            "[Scenery or place they loved — reflect in mood and metaphor]",
            preferredScenery,
            "",
            "[Five survey Q&As — the only basis for personality and letter]",
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
              "[아이 이름 — 편지에서 자연스럽게 부를 것]",
              petName,
              "",
              "[보호자가 적어 준, 아이가 사랑했던 풍경·장소 — 분위기와 은유에 반영할 것]",
              preferredScenery,
              "",
              "[설문 5문항과 답변 — 편지의 유일한 근거]",
              promptFormattedAnswers,
            ].join("\n")
          : [
              "[Companion’s name — use naturally in the letter]",
              petName,
              "",
              "[Scenery or place they loved — reflect in mood and metaphor]",
              preferredScenery,
              "",
              "[Five survey Q&As — the only basis for the letter]",
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
                  petName,
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
              model: "gpt-4o-mini",
              temperature: 0.9,
              frequency_penalty: 0.22,
              max_tokens: 2200,
              stream: true,
              messages: [
                {
                  role: "system",
                  content: [
                    plainLetterSystemPrompt(locale, petName, preferredScenery),
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
              send({
                type: "error",
                message: locale === "ko" ? "AI 편지 응답이 비어 있습니다." : "Empty letter response.",
              });
              controller.close();
              return;
            }

            await imageTask;

            const personality = await extractPersonalityFields(
              openai,
              locale,
              trimmedLetter,
              petName,
              preferredScenery,
              promptFormattedAnswers,
            );
            if (!personality.ok) {
              send({ type: "error", message: personality.error });
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
            );
            if (!saveResult.ok) {
              console.error("[generate-letter] save failed after retries:", saveResult.message);
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
              savedPetName: petName,
              persistenceFailed: !saveResult.ok,
            });
            controller.close();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown error while generating the letter.";
            send({ type: "error", message });
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
      model: "gpt-4o-mini",
      temperature: 0.9,
      frequency_penalty: 0.22,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [letterRoleAndStyle(locale, petName, preferredScenery), languageInstruction].join(
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
        petName,
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
        savedPetName: petName,
        persistenceFailed: false,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while generating the letter.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
