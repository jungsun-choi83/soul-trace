import type { LetterMode } from "../letter-mode.ts";
import { LIVING_FUNNEL } from "./living.ts";
import { MEMORIAL_FUNNEL } from "./memorial.ts";
import type { FunnelDefinition } from "./types.ts";

export { LIVING_FUNNEL } from "./living.ts";
export { MEMORIAL_FUNNEL } from "./memorial.ts";
export { memoryIds, type FunnelDefinition, type FunnelMemoryQuestionDef } from "./types.ts";

export function funnelFor(mode: LetterMode): FunnelDefinition {
  return mode === "living" ? LIVING_FUNNEL : MEMORIAL_FUNNEL;
}

export function funnelMemoryQuestionCount(mode: LetterMode): number {
  return funnelFor(mode).memoryQuestions.length;
}

export const MAX_FUNNEL_MEMORY_QUESTIONS = Math.max(
  LIVING_FUNNEL.memoryQuestions.length,
  MEMORIAL_FUNNEL.memoryQuestions.length,
);
