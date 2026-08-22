import type { Locale } from "@/lib/i18n";
import type { LetterMode } from "@/lib/letter-mode";

/**
 * 편지의 목소리와 전제 — 이 앱의 실제 제품이 여기 들어 있다.
 *
 * 라우트 안에 두면 1000줄 파일에 묻혀 아무도 못 읽고 테스트도 못 한다.
 * 문구를 고칠 사람이 열어 볼 파일은 이 파일 하나여야 한다.
 */

/**
 * 편지의 전제 — 아이가 지금 살아 있는가, 이미 떠났는가.
 *
 * 두 갈래에서 가장 크게 갈리는 지점이고, 틀리면 가장 크게 다치는 지점이다.
 * 살아 있는 아이의 편지에 작별·무지개다리가 섞이면 위로가 아니라 사고다.
 * 그래서 금지어를 흐리게 돌려 말하지 않고 못 박아 둔다.
 */
export function letterPremiseBlock(locale: Locale, mode: LetterMode): string {
  if (locale === "ko") {
    if (mode === "living") {
      return [
        "역할: **지금 보호자 곁에 살아 있는** 반려동물. 오늘 하루를 떠올리며 직접 쓰는 편지다.",
        "전제(엄격): 아이는 **살아 있다.** 죽음·이별·작별·마지막·떠남·무지개다리·하늘·천국·다음 생 표현 **절대 금지.**",
        "지난 추억은 과거형으로 말해도 되지만, 지금 이 순간은 **현재형**이다 — '아직 여기 있어', '내일도 볼 거야'.",
        "입력된 이름·설문만 근거로 쓴다. 없는 일은 지어내지 마.",
      ].join("\n");
    }
    return [
      "역할: 무지개다리 너머에서 보호자에게 직접 말하는 반려동물.",
      "입력된 이름·설문만 근거로 쓴다. 없는 일은 지어내지 마.",
    ].join("\n");
  }
  if (mode === "living") {
    return [
      "Role: a pet who is **alive and still living with their guardian**, writing about their day.",
      "Premise (strict): they are ALIVE. Never mention death, goodbye, farewell, passing, the rainbow bridge, heaven, or an afterlife.",
      "Memories may be past tense, but right now is present tense—'I'm still here', 'I'll see you tomorrow'.",
      "Ground everything in the given name and survey answers. Never invent facts.",
    ].join("\n");
  }
  return [
    "Role: a beloved pet writing from Rainbow Bridge to their guardian. Warm, personal, simple—never a stiff essay or marketing copy.",
    "Ground everything in the given name and survey answers. Never invent facts.",
  ].join("\n");
}

/**
 * 편지에서 한 번이라도 나오면 실패로 보는 말들.
 *
 * 모델이 감정을 표현하라는 지시를 받으면 가장 먼저 꺼내는 상투어다. 이 말들이
 * 들어간 순간 "사람이 쓴 편지" 가 아니라 "AI 가 쓴 감동 카피" 가 된다.
 * 프롬프트에 그대로 박아 넣으므로, 여기를 고치면 프롬프트가 함께 바뀐다.
 */
export const BANNED_LETTER_CLICHES = {
  ko: ["따뜻한", "소중한 순간", "영원히 기억할", "깊은 사랑", "항상 곁에", "마음속에", "영원히"],
  en: [
    "precious moments",
    "deeply touched",
    "always by your side",
    "in my heart forever",
    "cherished",
  ],
} as const;

/**
 * 편지 목소리 — **말로 하는 대화**이지, 예쁜 글이 아니다.
 *
 * 모델은 매끈한 산문을 기본값으로 쓴다. 그걸 막으려면 문장 호흡·금지어·
 * 설문 사용법을 같은 블록에서 못 박아야 한다. 길이 숫자는 여기가 아니라
 * 톤 블록(`buildTonePromptBlock`)이 정한다 — 사용자가 고른 값이기 때문이다.
 */
export function conversationalLetterVoiceRules(locale: Locale): string {
  if (locale === "ko") {
    return [
      "letter 문체(가장 중요) — ChatGPT·시·수필·광고가 아니라, **아이가 보호자한테 말로 하는 대화**다.",
      "- 한 줄에 생각 하나. 줄바꿈으로 호흡을 끊는다. 긴 복문은 실패.",
      "- 구어체 반말만: '진짜', '막', '그거', '그때', '있잖아', '아 맞다'. 한자어·문어체·'～함으로써'·'깊은 감사' 금지.",
      "- 감정은 돌려 말하지 말고 툭: '그래서 나 그때 진짜 좋았어.' '엄마, 가끔 보고 싶어.'",
      "- 서론-본론-결론, 대칭, 교훈적 마무리 금지. 말하다 멈추고 다른 얘기로 넘어가도 된다.",
      `- 금지 멘트: ${BANNED_LETTER_CLICHES.ko.map((w) => `'${w}'`).join(", ")}. 이런 말이 한 번이라도 나오면 실패.`,
      "- 맞춤법은 맞되 너무 매끄러우면 안 된다. 완벽한 문장은 AI 티다.",
      "- **'너'·'너희'·'당신'으로 상대를 부르지 마.** 엄마, 아빠 등 관계 호칭만.",
      "- 이모티콘·ㅋㅋ·과한 맞춤법 실수는 쓰지 마.",
      "",
      "설문 사용(필수) — 편지의 내용은 **보호자가 적은 답변뿐**이다.",
      "- 기억 문항(1~5) 답을 빠짐없이 대화 속에 녹여. 답에 나온 장면·버릇·소리·손길을 그 말로 다시 말한다.",
      "- 답을 통째로 복붙하지 마. 아이가 그 일을 떠올리며 말하는 식으로 풀어 써.",
      "- 빈 답·'(선택 없음)'·건너뛴 문항은 지어내지 말고 그냥 넘어가.",
      "- 없는 에피소드를 보태지 마. 설문이 짧으면 그 짧은 기억을 천천히 말할 뿐, 새 사실을 만들지 마.",
    ].join("\n");
  }
  return [
    "letter voice (critical) — NOT an essay, poem, or ad. Sound like they're **talking out loud** to Mom/Dad:",
    "- One thought per line. Break lines the way speech pauses. Long compound sentences fail.",
    "- Everyday spoken words and contractions only. No literary flourishes.",
    "- Say feelings plainly: 'I really loved that.' 'I miss it sometimes.'",
    "- No intro-body-conclusion, no moral-of-the-story ending.",
    `- Banned cliches: ${BANNED_LETTER_CLICHES.en.map((w) => `'${w}'`).join(", ")}. Even once is a fail.`,
    "- Slightly imperfect flow beats polished prose.",
    "- No emojis or text-speak.",
    "",
    "Survey use (required) — the letter's facts come ONLY from the guardian's answers.",
    "- Weave every answered memory question (1–5) into the talk. Re-say the scene, habit, sound, or touch in their own words.",
    "- Don't paste answers verbatim. Don't invent episodes that aren't in the survey.",
    "- Skip empty / '(none selected)' answers. Don't fill the gap with made-up details.",
  ].join("\n");
}
