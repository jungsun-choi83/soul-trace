import en from "@/locales/en.json";
import ko from "@/locales/ko.json";
import type { Locale } from "@/lib/i18n";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
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
};

type ParsedResponse = {
  personalityType: string;
  personalitySummary: string;
  letter: string;
};

const ERR = { ko: ko.errors, en: en.errors };

function err(locale: Locale, key: keyof typeof ko.errors, status: number) {
  return NextResponse.json({ error: ERR[locale][key] }, { status });
}

function letterRoleAndStyle(locale: Locale): string {
  if (locale === "ko") {
    return [
      "역할: 너는 무지개 다리 너머에서 보호자(엄마/아빠)에게 글을 쓰는 반려견이다.",
      "반드시 아래에 주어진 「아이 이름」「기억 속 풍경」「5문항 설문 답변」만을 근거로 쓴다. 상상으로 사실을 지어내지 말고, 답변에 나온 단어·장면·감각을 편지 곳곳에 녹인다.",
      "personalityType: 설문 내용에서 드러난 성향·에너지를 바탕으로, 이번 세트의 답변에만 어울리는 시적인 칭호 한 줄(예: MBTI처럼 유형 이름처럼 짓되, 다른 사람에게 복붙해 쓰면 안 되는 고유한 표현).",
      "personalitySummary: 답변 속 구체적 순간·습관·감정을 2~4개 엮어 2~3문장으로 요약한다.",
      "letter: 아이 이름을 자연스럽게 부르며, 기억 속 풍경의 분위기(빛·바람·냄새 등)를 한두 번 은유로 얹는다. 설문에 나온 순간을 장면처럼 그리듯 서술해 감동을 살린다. 뻔한 상투문구·클리셰 반복을 피하고, 이 아이만의 이야기처럼 읽히게 한다.",
      "다른 세션과 문장·칭호가 겹치지 않게, 매번 다른 구조와 다른 이미지로 쓴다.",
    ].join("\n");
  }
  return [
    "Role: You are the companion writing from beyond the rainbow bridge to your guardian.",
    "Ground EVERYTHING in the given companion name, favorite scenery, and the five survey answers below. Do not invent facts not supported by the answers; instead, weave their concrete words, scenes, and sensations into the prose.",
    "personalityType: A single poetic, MBTI-like label that fits ONLY this answer set—unique per session, not a reusable generic slogan.",
    "personalitySummary: 2–3 sentences binding 2–4 specific moments or habits drawn verbatim from the answers.",
    "letter: Address the guardian warmly; naturally use the companion’s name; echo the scenery’s mood (light, air, scent) once or twice as gentle metaphor. Build intimacy through sensory, survey-specific scenes. Avoid stock phrases and template openings—make it feel like one-of-a-kind.",
    "Vary structure and imagery so different guardians never get interchangeable text.",
  ].join("\n");
}

const DALLE_BASE_PROMPT = `A cohesive, ethereal, and artistic background for a pet memorial letter. The style must be minimalistic, cinematic, and filled with soft, golden light. The imagery should subtly reflect the pet's personality and memories based on the user's answers (e.g., a calm forest for a quiet pet, a bright beach for an energetic pet). NO TEXT, NO LOGOS. Just a peaceful, heavenly atmosphere with wide-angle perspective.`;

function buildDallePrompt(
  formattedAnswers: string,
  petName: string,
  preferredScenery: string,
): string {
  return [
    DALLE_BASE_PROMPT,
    "",
    "Use the following guardian memories only as subtle visual inspiration (never depict any written text in the image):",
    formattedAnswers,
    "",
    `Companion name (emotional inspiration only, never render as text): ${petName}`,
    `Favorite scenery mentioned (mood reference): ${preferredScenery}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 500 },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Supabase environment variables are not configured." },
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

    const formattedAnswers = answers
      .map((item, index) => `${index + 1}. Q: ${item.question}\nA: ${item.answer}`)
      .join("\n\n");

    const languageInstruction =
      locale === "ko"
        ? [
            "출력 JSON의 personalityType, personalitySummary, letter 값은 모두 한국어로만 작성한다.",
            "말투는 따뜻하고 정중하되, 설문에 맞는 개성이 드러나게 한다.",
            "letter는 한국어 기준 약 480~580자. 문장 호흡은 길게 이어질 수 있으나 장황한 반복은 피한다.",
          ].join("\n")
        : [
            "Write every JSON value (personalityType, personalitySummary, letter) in English only.",
            "Warm, intimate, gentle voice—never corporate; let the survey’s specifics show through.",
            "The letter should be roughly 400–600 characters in English.",
          ].join("\n");

    const openai = new OpenAI({ apiKey });

    const userPayload =
      locale === "ko"
        ? [
            "Return JSON only with these exact keys: personalityType, personalitySummary, letter.",
            "",
            "[아이 이름 — 편지에서 자연스럽게 부를 것]",
            petName,
            "",
            "[보호자가 적어 준, 아이가 사랑했던 풍경·장소 — 분위기와 은유에 반영할 것]",
            preferredScenery,
            "",
            "[설문 5문항과 답변 — 성향·편지의 유일한 근거]",
            formattedAnswers,
          ].join("\n")
        : [
            "Return JSON only with these exact keys: personalityType, personalitySummary, letter.",
            "",
            "[Companion’s name — use naturally in the letter]",
            petName,
            "",
            "[Scenery or place they loved — reflect in mood and metaphor]",
            preferredScenery,
            "",
            "[Five survey Q&As — the only basis for personality and letter]",
            formattedAnswers,
          ].join("\n");

    const letterPromise = openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 1.12,
      frequency_penalty: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [letterRoleAndStyle(locale), languageInstruction].join("\n\n"),
        },
        {
          role: "user",
          content: userPayload,
        },
      ],
    });

    const imagePrompt = buildDallePrompt(formattedAnswers, petName, preferredScenery);
    const imagePromise = openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
      quality: "hd",
    });

    const [letterSettled, imageSettled] = await Promise.allSettled([
      letterPromise,
      imagePromise,
    ]);

    if (letterSettled.status === "rejected") {
      throw letterSettled.reason;
    }

    const completion = letterSettled.value;
    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: locale === "ko" ? "AI 응답이 비어 있습니다." : "Empty AI response." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(content) as ParsedResponse;
    if (!parsed.personalityType || !parsed.personalitySummary || !parsed.letter) {
      return NextResponse.json(
        { error: locale === "ko" ? "AI 응답 형식이 올바르지 않습니다." : "Invalid AI response shape." },
        { status: 502 },
      );
    }

    let heroImageUrl: string | null = null;
    let heroImageSkipped = false;
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { error: profileError } = await supabase.from("soul_trace_profiles").upsert(
      {
        user_email: userEmail,
        pet_name: petName,
        personality_type: parsed.personalityType,
        generated_letter: parsed.letter,
        preferred_scenery: preferredScenery,
        hero_image_url: heroImageUrl,
      },
      { onConflict: "user_email" },
    );

    if (profileError) {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? `프로필 저장 중 오류가 발생했습니다: ${profileError.message}`
              : `Could not save profile: ${profileError.message}`,
        },
        { status: 500 },
      );
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
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? `기존 답변 정리 중 오류가 발생했습니다: ${deleteError.message}`
              : `Could not reset previous answers: ${deleteError.message}`,
        },
        { status: 500 },
      );
    }

    const { error: answerSaveError } = await supabase
      .from("soul_trace_answers")
      .insert(answerRows);
    if (answerSaveError) {
      return NextResponse.json(
        {
          error:
            locale === "ko"
              ? `답변 저장 중 오류가 발생했습니다: ${answerSaveError.message}`
              : `Could not save answers: ${answerSaveError.message}`,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...parsed,
      heroImageUrl,
      heroImageSkipped,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while generating the letter.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
