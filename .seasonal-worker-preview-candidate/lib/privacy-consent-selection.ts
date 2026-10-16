export type PrivacySectionKey = "privacy" | "marketing" | "aiImprovement";
export type PrivacySelections = Record<PrivacySectionKey, boolean>;

export const EMPTY_PRIVACY_SELECTIONS: PrivacySelections = { privacy: false, marketing: false, aiImprovement: false };

// Existing law/configuration does not mark AI-improvement consent as required.
export function requiredPrivacyItemsAgreed(selections: PrivacySelections): boolean { return selections.privacy; }
export function allPrivacyItemsAgreed(selections: PrivacySelections): boolean { return Object.values(selections).every(Boolean); }
export function setAllPrivacyItems(checked: boolean): PrivacySelections { return { privacy: checked, marketing: checked, aiImprovement: checked }; }
export function isPrivacySelections(value: unknown): value is PrivacySelections {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["privacy", "marketing", "aiImprovement"].every((key) => typeof record[key] === "boolean");
}
