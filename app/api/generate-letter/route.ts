import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type AnswerInput = {
  question: string;
  answer: string;
};

type RequestBody = {
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

const SYSTEM_PROMPT =
  "너는 무지개다리를 건넌 강아지야. 주인이 입력한 추억을 바탕으로 아주 따뜻하고 사랑스러운 편지를 써줘.";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Supabase 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as RequestBody;
    const userEmail = body.userEmail?.trim().toLowerCase() ?? "";
    const petName = body.petName?.trim() ?? "";
    const preferredScenery = body.preferredScenery?.trim() ?? "";
    const privacyConsent = body.privacyConsent ?? false;
    const answers = body.answers ?? [];
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail);

    if (!isEmailValid) {
      return NextResponse.json(
        { error: "유효한 이메일 주소를 입력해주세요." },
        { status: 400 },
      );
    }
    if (!petName || !preferredScenery) {
      return NextResponse.json(
        { error: "아이 이름과 선호 풍경을 입력해주세요." },
        { status: 400 },
      );
    }
    if (!privacyConsent) {
      return NextResponse.json(
        {
          error:
            "입력하신 정보는 나중에 이터널빔 기계 설정 및 맞춤형 서비스 제공을 위해 안전하게 보관됩니다 항목에 동의가 필요합니다.",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return NextResponse.json(
        { error: "질문 답변 5개가 필요합니다." },
        { status: 400 },
      );
    }

    const formattedAnswers = answers
      .map((item, index) => `${index + 1}. 질문: ${item.question}\n답변: ${item.answer}`)
      .join("\n\n");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            "다음의 5개 답변을 바탕으로 반려견의 성향(MBTI 스타일)을 분석해줘.",
            "출력은 반드시 JSON 한 개만 반환하고 아래 키를 정확히 지켜줘.",
            "- personalityType: 짧고 감성적인 성향 이름 (예: 햇살같은 탐험가형)",
            "- personalitySummary: 2~3문장 분석",
            "- letter: 450~550자 분량의 한국어 편지",
            "",
            "[보호자 답변]",
            formattedAnswers,
          ].join("\n"),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "AI 응답이 비어 있습니다." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(content) as ParsedResponse;
    if (!parsed.personalityType || !parsed.personalitySummary || !parsed.letter) {
      return NextResponse.json(
        { error: "AI 응답 형식이 올바르지 않습니다." },
        { status: 502 },
      );
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
      },
      { onConflict: "user_email" },
    );

    if (profileError) {
      return NextResponse.json(
        { error: `프로필 저장 중 오류가 발생했습니다: ${profileError.message}` },
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
        { error: `기존 답변 정리 중 오류가 발생했습니다: ${deleteError.message}` },
        { status: 500 },
      );
    }

    const { error: answerSaveError } = await supabase
      .from("soul_trace_answers")
      .insert(answerRows);
    if (answerSaveError) {
      return NextResponse.json(
        { error: `답변 저장 중 오류가 발생했습니다: ${answerSaveError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "편지 생성 중 알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
