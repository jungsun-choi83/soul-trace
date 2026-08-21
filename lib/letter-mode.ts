import type { Messages } from "@/lib/i18n";

/**
 * 편지의 갈래 — 아이가 지금 곁에 있는지, 이미 떠났는지.
 *
 * 두 갈래는 같은 흐름(프로필 → 설문 → 편지)을 쓰지만 **시제와 전제가 통째로
 * 다르다.** 살아 있는 아이에게 "마지막으로 전하지 못한 말"을 쓰게 하면 그건
 * 위로가 아니라 사고다. 그래서 모드는 문구뿐 아니라 프롬프트까지 갈라 놓는다.
 */
export type LetterMode = "living" | "memorial";

export const LETTER_MODES: readonly LetterMode[] = ["living", "memorial"];

/** 편지를 만든 적 없는 옛 클라이언트·저장된 링크는 추모 갈래로 본다(기존 동작). */
export const DEFAULT_LETTER_MODE: LetterMode = "memorial";

export function isLetterMode(value: unknown): value is LetterMode {
  return value === "living" || value === "memorial";
}

export function letterModePath(mode: LetterMode): string {
  return `/${mode}`;
}

export type ModeSurveyItem = {
  promptText: string;
  placeholder: string;
  example?: string;
  optional?: boolean;
  optionalNote?: string;
  skipLabel?: string;
};

export type ModeToneItem = {
  id: string;
  promptText: string;
  options: { id: string; label: string }[];
};

export type ModeCopy = {
  landingCta: string;
  landingHint: string;
  headline: string;
  subline: string;
  letterHeading: string;
  q1Label: string;
  q2Label: string;
  yearPartedPlaceholder: string;
  memory: ModeSurveyItem[];
  tone: ModeToneItem[];
};

/**
 * 로케일 JSON 에서 한 갈래의 문구를 꺼낸다.
 *
 * `Messages` 는 ko.json 에서 추론되는데, 두 갈래의 설문 항목은 선택 필드
 * (`optional`·`skipLabel`)가 서로 달라 추론 타입이 갈린다. 읽는 쪽마다 좁히지
 * 않도록 여기서 한 번만 형태를 고정한다.
 */
export function modeCopy(messages: Messages, mode: LetterMode): ModeCopy {
  return messages.modes[mode] as unknown as ModeCopy;
}
