import type { FunnelDefinition } from "./types.ts";

/** Memorial funnel: recognition through memory. Independent of the living question list. */
export const MEMORIAL_FUNNEL: FunnelDefinition = {
  mode: "memorial",
  memoryQuestions: [
    { id: "memorial-habit", step: 1, type: "text", required: true, generationField: "distinctiveHabit" },
    { id: "memorial-affection", step: 2, type: "text", required: true, generationField: "affection" },
    { id: "memorial-excitement", step: 3, type: "text", required: true, generationField: "excitementSignal" },
    { id: "memorial-comfort", step: 4, type: "text", required: true, generationField: "comfortablePlace" },
    { id: "memorial-scene", step: 5, type: "text", required: true, generationField: "clearestScene" },
    { id: "memorial-unique", step: 6, type: "text", required: true, generationField: "uniqueTrait" },
    { id: "memorial-unsaid", step: 7, type: "text", required: false, generationField: "optionalMessage" },
  ],
  toneMoods: [{ id: "calm" }, { id: "warm" }, { id: "bright" }],
};
