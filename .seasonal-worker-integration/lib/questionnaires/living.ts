import type { FunnelDefinition } from "./types.ts";

/** Living funnel: current everyday life. Independent of the memorial question list. */
export const LIVING_FUNNEL: FunnelDefinition = {
  mode: "living",
  memoryQuestions: [
    { id: "living-habit", step: 1, type: "text", required: true, generationField: "strangeHabit" },
    { id: "living-affection", step: 2, type: "text", required: true, generationField: "affection" },
    { id: "living-excitement", step: 3, type: "text", required: true, generationField: "excitementSignal" },
    { id: "living-routine", step: 4, type: "text", required: true, generationField: "everydayRoutine" },
    { id: "living-scene", step: 5, type: "text", required: true, generationField: "everydayScene" },
  ],
  toneMoods: [{ id: "bright" }, { id: "calm" }, { id: "warm" }],
};
