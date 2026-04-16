import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Supabase 환경 변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "유효한 email 쿼리 파라미터가 필요합니다." },
      { status: 400 },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: profile, error: profileError } = await supabase
    .from("soul_trace_profiles")
    .select("user_email, pet_name, personality_type, generated_letter, preferred_scenery")
    .eq("user_email", email)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "해당 이메일의 저장 데이터를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { data: answers, error: answersError } = await supabase
    .from("soul_trace_answers")
    .select("answer_order, question, answer")
    .eq("user_email", email)
    .order("answer_order", { ascending: true });

  if (answersError) {
    return NextResponse.json(
      { error: `답변 데이터를 불러오지 못했습니다: ${answersError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ...profile,
    answers: answers ?? [],
  });
}
