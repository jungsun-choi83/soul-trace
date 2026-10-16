import type { LetterMode } from "../letter-mode.ts";

export type FunnelToneMoodId = "bright" | "calm" | "warm";

export type FunnelMemoryQuestionDef = {
  id: string;
  step: number;
  type: "text";
  required: boolean;
  generationField: string;
};

export type FunnelDefinition = {
  mode: LetterMode;
  memoryQuestions: readonly FunnelMemoryQuestionDef[];
  toneMoods: readonly { id: FunnelToneMoodId }[];
};

export function memoryIds(funnel: FunnelDefinition): string[] {
  return funnel.memoryQuestions.map((question) => question.id);
}
