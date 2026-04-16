"use client";

import { toBlob, toPng } from "html-to-image";
import { useRef, useState } from "react";

type Question = {
  id: string;
  prompt: string;
  placeholder: string;
};

type GeneratedResult = {
  personalityType: string;
  personalitySummary: string;
  letter: string;
};

const QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt: "아이의 가장 밝았던 에너지는 어떤 순간에 반짝였나요?",
    placeholder: "예: 아침마다 꼬리를 흔들며 인사하던 순간",
  },
  {
    id: "q2",
    prompt: "아이가 가장 좋아했던 산책길의 냄새나 장소는 어디였나요?",
    placeholder: "예: 비 온 뒤 흙냄새가 나는 공원 입구",
  },
  {
    id: "q3",
    prompt: "아이가 당신에게 자주 보여주던 사랑의 표현은 무엇이었나요?",
    placeholder: "예: 소파에 먼저 올라와 기대앉던 습관",
  },
  {
    id: "q4",
    prompt: "지금도 가장 선명하게 떠오르는 아이의 표정은 어떤 모습인가요?",
    placeholder: "예: 간식을 기다리며 눈이 동그래지던 얼굴",
  },
  {
    id: "q5",
    prompt: "아이가 당신에게 마지막으로 남기고 싶어할 메시지는 무엇일까요?",
    placeholder: "예: 엄마, 나 때문에 울지 말고 웃어줘",
  },
];

const CAPTURE_OPTIONS = {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: "#000000",
  // Avoid CORS-protected stylesheet parsing errors from external font CSS.
  skipFonts: true,
} as const;

export default function Home() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(() => Array(QUESTIONS.length).fill(""));
  const [userEmail, setUserEmail] = useState("");
  const [petName, setPetName] = useState("");
  const [preferredScenery, setPreferredScenery] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  /** Web Share API는 사용자 제스처 직후에만 허용되므로, 이미지는 1차 클릭에서 만들고 2차 클릭에서 공유합니다. */
  const [shareableFile, setShareableFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  const isLastQuestion = step === QUESTIONS.length - 1;
  const isAnswerValid = answers[step]?.trim().length > 0;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail.trim());
  const isProfileValid =
    isEmailValid && petName.trim().length > 0 && preferredScenery.trim().length > 0 && privacyConsent;

  const handleChangeAnswer = (value: string) => {
    const next = [...answers];
    next[step] = value;
    setAnswers(next);
  };

  const goNext = () => {
    if (!isAnswerValid) return;
    setStep((prev) => Math.min(prev + 1, QUESTIONS.length - 1));
  };

  const goPrev = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const submitAnswers = async () => {
    if (!answers.every((answer) => answer.trim())) {
      setError("모든 문항을 채워주세요.");
      return;
    }
    if (!isProfileValid) {
      setError("이메일, 아이 이름, 기억 풍경, 개인정보 동의 항목을 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = QUESTIONS.map((question, index) => ({
        question: question.prompt,
        answer: answers[index].trim(),
      }));

      const response = await fetch("/api/generate-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: userEmail.trim(),
          petName: petName.trim(),
          preferredScenery: preferredScenery.trim(),
          privacyConsent,
          answers: payload,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? "편지 생성에 실패했습니다.");
      }

      const data = (await response.json()) as GeneratedResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!captureRef.current) return;
    try {
      setError(null);
      const dataUrl = await toPng(captureRef.current, CAPTURE_OPTIONS);
      const anchor = document.createElement("a");
      anchor.download = "soul-trace-letter.png";
      anchor.href = dataUrl;
      anchor.click();
    } catch (err) {
      setError(
        err instanceof Error
          ? `이미지 저장에 실패했습니다: ${err.message}`
          : "이미지 저장 중 오류가 발생했습니다.",
      );
    }
  };

  /** 1단계: 비동기로 PNG 생성 (여기서는 share 호출 금지) */
  const prepareInstagramShare = async () => {
    if (!captureRef.current) return;
    setIsSharing(true);
    setError(null);
    try {
      const blob = await toBlob(captureRef.current, CAPTURE_OPTIONS);
      if (!blob) {
        throw new Error("이미지를 생성하지 못했습니다.");
      }
      const file = new File([blob], "soul-trace-letter.png", { type: "image/png" });
      setShareableFile(file);
    } catch (err) {
      setShareableFile(null);
      setError(err instanceof Error ? err.message : "공유 준비 중 오류가 발생했습니다.");
    } finally {
      setIsSharing(false);
    }
  };

  /** 2단계: 동기적으로만 share (사용자 클릭 직후 호출) */
  const openInstagramShare = () => {
    if (!shareableFile) return;
    setError(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        if (navigator.canShare?.({ files: [shareableFile] })) {
          void navigator.share({
            title: "Soul Trace 편지",
            text: "우리 아이가 남긴 Soul Trace 편지를 공유합니다.",
            files: [shareableFile],
          });
          return;
        }
      }
      const url = URL.createObjectURL(shareableFile);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "soul-trace-letter.png";
      anchor.click();
      URL.revokeObjectURL(url);
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "공유 중 오류가 발생했습니다.");
    }
  };

  const onInstagramButtonClick = () => {
    if (shareableFile) {
      openInstagramShare();
      return;
    }
    void prepareInstagramShare();
  };

  const resetTest = () => {
    setStep(0);
    setAnswers(Array(QUESTIONS.length).fill(""));
    setUserEmail("");
    setPetName("");
    setPreferredScenery("");
    setPrivacyConsent(false);
    setResult(null);
    setShareableFile(null);
    setError(null);
  };

  if (result) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10 md:px-8">
        <section className="w-full max-w-3xl space-y-6">
          <div
            ref={captureRef}
            className="rounded-3xl border border-[#D4AF37]/50 bg-[#090909] p-7 shadow-[0_0_60px_rgba(212,175,55,0.14)] md:p-10"
          >
            <p className="font-title text-sm uppercase tracking-[0.24em] text-[#D4AF37]">
              Soul Trace Result
            </p>
            <h1 className="font-title mt-4 text-4xl leading-tight text-[#F7F2E7] md:text-5xl">
              {result.personalityType}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#D5CCB5] md:text-base">
              {result.personalitySummary}
            </p>

            <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-black/40 p-6 md:p-8">
              <p className="font-title mb-4 text-lg text-[#D4AF37]">
                엄마/아빠에게 전하는 미래의 편지
              </p>
              <p className="whitespace-pre-line text-[15px] leading-8 text-[#F7F2E7] md:text-base">
                {result.letter}
              </p>
            <p className="mt-6 text-xs tracking-[0.04em] text-[#b8ac8c]">
              기록 이메일: {userEmail}
            </p>
            </div>
          </div>

          <a
            href="https://eternalbeam.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-title block w-full rounded-2xl border border-[#D4AF37] bg-[#D4AF37] px-6 py-4 text-center text-xl text-black transition hover:bg-[#c69a1e]"
          >
            아이를 빛으로 다시 만나는 법
          </a>

          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleDownloadImage}
              className="rounded-xl border border-[#D4AF37]/70 px-4 py-3 text-sm text-[#F7F2E7] transition hover:bg-[#D4AF37]/10"
            >
              편지 이미지 저장
            </button>
            <button
              type="button"
              onClick={onInstagramButtonClick}
              disabled={isSharing}
              className="rounded-xl border border-[#D4AF37] bg-[#D4AF37] px-4 py-3 text-sm text-black transition hover:bg-[#c69a1e] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSharing
                ? "이미지 준비 중..."
                : shareableFile
                  ? "인스타에서 공유하기 (2단계)"
                  : "인스타용 이미지 준비 (1단계)"}
            </button>
            <button
              type="button"
              onClick={resetTest}
              className="rounded-xl border border-white/25 px-4 py-3 text-sm text-white transition hover:bg-white/10"
            >
              테스트 다시하기
            </button>
          </div>
          {shareableFile && !isSharing ? (
            <p className="text-center text-xs leading-6 text-[#b8ac8c]">
              1단계가 끝났습니다. 같은 버튼을 한 번 더 눌러 공유 창을 여세요. (PC에서는 이미지 저장 후
              인스타가 열릴 수 있어요)
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10 md:px-8">
      <section className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <p className="font-title text-sm uppercase tracking-[0.22em] text-[#D4AF37]">
            Eternal Beam Pre-Marketing
          </p>
          <h1 className="font-title mt-4 text-5xl text-[#F7F2E7] md:text-6xl">Soul Trace</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[#D5CCB5] md:text-base">
            아이와의 추억을 따라가며 5개의 질문에 답해보세요. 당신의 기억을 바탕으로 아이의
            성향을 분석하고, AI가 따뜻한 미래의 편지를 전해드립니다.
          </p>
        </div>

        <article className="rounded-3xl border border-[#D4AF37]/50 bg-[#090909] p-6 shadow-[0_0_60px_rgba(212,175,55,0.14)] md:p-10">
          <div className="mb-8 grid gap-3 md:grid-cols-2">
            <input
              type="email"
              value={userEmail}
              onChange={(event) => setUserEmail(event.target.value)}
              placeholder="이메일 주소 (기계 연동 키)"
              className="w-full rounded-xl border border-[#D4AF37]/35 bg-black/50 px-4 py-3 text-sm text-[#F7F2E7] outline-none transition focus:border-[#D4AF37]"
            />
            <input
              type="text"
              value={petName}
              onChange={(event) => setPetName(event.target.value)}
              placeholder="아이 이름"
              className="w-full rounded-xl border border-[#D4AF37]/35 bg-black/50 px-4 py-3 text-sm text-[#F7F2E7] outline-none transition focus:border-[#D4AF37]"
            />
            <input
              type="text"
              value={preferredScenery}
              onChange={(event) => setPreferredScenery(event.target.value)}
              placeholder="아이가 가장 좋아했던 풍경"
              className="w-full rounded-xl border border-[#D4AF37]/35 bg-black/50 px-4 py-3 text-sm text-[#F7F2E7] outline-none transition focus:border-[#D4AF37] md:col-span-2"
            />
            <label className="md:col-span-2 flex items-start gap-3 rounded-xl border border-white/20 bg-black/40 p-3">
              <input
                type="checkbox"
                checked={privacyConsent}
                onChange={(event) => setPrivacyConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
              />
              <span className="text-xs leading-6 text-[#E8DFC6]">
                입력하신 정보는 나중에 이터널빔 기계 설정 및 맞춤형 서비스 제공을 위해 안전하게
                보관됩니다
              </span>
            </label>
          </div>

          <div className="mb-6 flex items-center justify-between text-xs tracking-[0.12em] text-[#D4AF37]">
            <span>QUESTION {step + 1}</span>
            <span>{QUESTIONS.length}</span>
          </div>
          <div className="mb-7 h-1 overflow-hidden rounded-full bg-[#2f2b1d]">
            <div
              className="h-full rounded-full bg-[#D4AF37] transition-all duration-300"
              style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
            />
          </div>

          <p className="font-title text-2xl leading-relaxed text-[#F7F2E7] md:text-3xl">
            {QUESTIONS[step].prompt}
          </p>

          <textarea
            value={answers[step]}
            onChange={(event) => handleChangeAnswer(event.target.value)}
            placeholder={QUESTIONS[step].placeholder}
            rows={5}
            className="mt-6 w-full resize-none rounded-2xl border border-[#D4AF37]/30 bg-black/50 p-4 text-sm leading-7 text-[#F7F2E7] outline-none transition focus:border-[#D4AF37] md:text-base"
          />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={step === 0}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전 질문
            </button>
            {isLastQuestion ? (
              <button
                type="button"
                onClick={submitAnswers}
                disabled={isLoading || !isAnswerValid || !isProfileValid}
                className="rounded-xl border border-[#D4AF37] bg-[#D4AF37] px-4 py-3 text-sm text-black transition hover:bg-[#c69a1e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "편지 생성 중..." : "AI 편지 생성하기"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!isAnswerValid}
                className="rounded-xl border border-[#D4AF37] bg-[#D4AF37] px-4 py-3 text-sm text-black transition hover:bg-[#c69a1e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                다음 질문
              </button>
            )}
          </div>
        </article>
        {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}
      </section>
    </main>
  );
}
