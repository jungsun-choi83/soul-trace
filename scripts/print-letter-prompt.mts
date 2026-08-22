/**
 * 편지 프롬프트를 그대로 찍어 본다 — OpenAI 를 부르지 않는다.
 *
 * 문체·길이 규칙을 고친 뒤 "모델이 실제로 무엇을 받는가" 를 눈으로 확인하는 용도다.
 * 규칙이 프롬프트에 안 실려 있으면 결과가 안 바뀌는데, 그건 편지를 뽑아 보기
 * 전까지 알 수 없다. 이 스크립트가 그 확인을 공짜로 만든다.
 *
 *   node --experimental-strip-types scripts/print-letter-prompt.mts
 *   node --experimental-strip-types scripts/print-letter-prompt.mts living en short
 */
import en from "../locales/en.json" with { type: "json" };
import ko from "../locales/ko.json" with { type: "json" };
import type { Locale, Messages } from "../lib/i18n.ts";
import { isLetterMode, type LetterMode } from "../lib/letter-mode.ts";
import { conversationalLetterVoiceRules, letterPremiseBlock } from "../lib/letter-voice.ts";
import { buildLetterAddressingBlock, buildPetProfilePromptBlock } from "../lib/pet-profile.ts";
import { buildTonePromptBlock, type LetterLength } from "../lib/survey.ts";

const [rawMode = "memorial", rawLocale = "ko", rawLength = "normal"] = process.argv.slice(2);
const mode: LetterMode = isLetterMode(rawMode) ? rawMode : "memorial";
const locale: Locale = rawLocale === "en" ? "en" : "ko";
const length: LetterLength = rawLength === "short" ? "short" : "normal";
const messages = (locale === "ko" ? ko : en) as unknown as Messages;

const profile = {
  petName: "콩",
  petNickname: "콩이",
  petType: "dog" as const,
  yearMet: "2015",
  yearParted: mode === "living" ? String(new Date().getFullYear()) : "2024",
  letterRecipient: "mom" as const,
  letterRecipientDetail: "",
};
const tonePrefs = { mood: "warm" as const, options: ["frequent_name" as const], length };

const section = (title: string, body: string) =>
  `\n${"═".repeat(72)}\n${title}\n${"═".repeat(72)}\n${body}`;

console.log(`편지 프롬프트 — mode=${mode} locale=${locale} length=${length}`);
console.log(section("[편지 호칭] 첫 문장·호칭·마무리 필수 문장", buildLetterAddressingBlock(locale, profile, mode)));
console.log(section("[전제] 살아 있는가 / 떠났는가", letterPremiseBlock(locale, mode)));
console.log(section("[문체] 대화체 + 설문 사용 규칙", conversationalLetterVoiceRules(locale)));
console.log(section("[톤 · 길이] 사용자가 고른 값에서 나온다", buildTonePromptBlock(locale, tonePrefs, messages, mode)));
console.log(section("[프로필]", buildPetProfilePromptBlock(locale, profile, mode)));
