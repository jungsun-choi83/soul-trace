import { polaroidOccasionItem } from "./polaroid-theme-catalog.ts";

/** Resolve only known, implemented occasions; old Halloween results have no metadata. */
export function persistedPolaroidOccasionId(
  generationMetadata: unknown,
  themeId: string,
): string | null {
  if (generationMetadata && typeof generationMetadata === "object" && !Array.isArray(generationMetadata)) {
    const occasionId = (generationMetadata as Record<string, unknown>).occasionId;
    if (typeof occasionId === "string" && polaroidOccasionItem(occasionId)?.implemented) {
      return occasionId;
    }
  }

  return themeId === "halloween" ? "halloween" : null;
}
