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

const SYSTEM_PROMPT_BASE =
  "You are a dog who has crossed the rainbow bridge. Write from the heart using the guardian's memories.";

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
            "선택된 언어가 한국어이면 모든 출력 값을 한국어로 작성해줘.",
            "한국어일 때는 아주 따뜻하고 정중한 말투를 사용해줘.",
            "편지(letter)는 한국어로 약 450~550자 분량으로 작성해줘.",
          ].join("\n")
        : [
            "If the selected language is English, write every output value in English.",
            "In English, keep a warm, intimate, gentle tone—never cold or corporate.",
            "The letter should be about 400–600 characters in English.",
          ].join("\n");

    const openai = new OpenAI({ apiKey });

    const letterPromise = openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [SYSTEM_PROMPT_BASE, languageInstruction].join("\n\n"),
        },
        {
          role: "user",
          content: [
            "Analyze the companion's personality in an MBTI-like poetic style based on the 5 answers.",
            "Return JSON only with these exact keys: personalityType, personalitySummary, letter.",
            languageInstruction,
            "",
            "[Guardian answers]",
            formattedAnswers,
          ].join("\n"),
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
    if (imageSettled.status === "fulfilled") {
      const rows = imageSettled.value.data;
      const url = rows?.[0]?.url;
      heroImageUrl = url ?? null;
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
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while generating the letter.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
